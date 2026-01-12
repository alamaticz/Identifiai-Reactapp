import os
import pandas as pd
from opensearchpy import OpenSearch, helpers
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER")
OPENSEARCH_PASS = os.getenv("OPENSEARCH_PASS")

def get_opensearch_client():
    """Create and return OpenSearch client."""
    if not OPENSEARCH_URL:
        print("[ERROR] OPENSEARCH_URL not set in environment.")
        return None
        
    auth = (OPENSEARCH_USER, OPENSEARCH_PASS) if OPENSEARCH_USER else None
    
    return OpenSearch(
        hosts=[OPENSEARCH_URL],
        http_auth=auth,
        verify_certs=False,
        ssl_show_warn=False,
        timeout=500
    )

def calculate_summary_metrics(client):
    """Calculate summary metrics for the dashboard."""
    metrics = {
        "total_errors": 0,
        "unique_issues": 0,
        "most_frequent": "N/A",
        "last_incident": "N/A"
    }
    
    try:
        # Total Errors
        count_res = client.count(body={"query": {"match": {"log.level": "ERROR"}}}, index="pega-logs")
        metrics["total_errors"] = count_res["count"]
        
        # Unique Issues
        try:
             unique_res = client.count(index="pega-analysis-results")
             metrics["unique_issues"] = unique_res["count"]
        except:
             metrics["unique_issues"] = 0

        # Top Rule Error
        rule_query = {
            "size": 1,
            "query": {"term": {"group_type": "RuleSequence"}},
            "sort": [{"count": {"order": "desc"}}]
        }
        rule_res = client.search(body=rule_query, index="pega-analysis-results")
        
        if rule_res["hits"]["hits"]:
            top_src = rule_res["hits"]["hits"][0]["_source"]
            sig = top_src.get("group_signature", "")
            
            # Parse Rule Name
            first_part = sig.split('|')[0].strip()
            tokens = first_part.split('->')
            if len(tokens) >= 2:
                metrics["most_frequent"] = tokens[1]
            else:
                metrics["most_frequent"] = sig[:30] + "..."
        else:
            metrics["most_frequent"] = "None"
            
        # Last Incident
        last_query = {
            "size": 1,
            "sort": [{"ingestion_timestamp": {"order": "desc"}}],
            "query": {"match": {"log.level": "ERROR"}}
        }
        last_res = client.search(body=last_query, index="pega-logs")
        if last_res["hits"]["hits"]:
            timestamp = last_res["hits"]["hits"][0]["_source"].get("ingestion_timestamp")
            try:
                dt = pd.to_datetime(timestamp, format='mixed')
                suffix = 'th' if 11 <= dt.day <= 13 else {1:'st', 2:'nd', 3:'rd'}.get(dt.day % 10, 'th')
                date_part = f"{dt.day}{suffix} {dt.strftime('%b').lower()} {dt.year}"
                time_part = dt.strftime('%I:%M %p').lstrip('0').lower()
                metrics["last_incident"] = f"{date_part} , {time_part}"
            except Exception:
                metrics["last_incident"] = timestamp
            
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        
    return metrics

def fetch_log_level_distribution(client):
    """Fetch distribution of log levels."""
    query = {
        "size": 0,
        "aggs": {
            "levels": {
                "terms": {"field": "log.level"}
            }
        }
    }
    try:
        response = client.search(body=query, index="pega-logs")
        buckets = response['aggregations']['levels']['buckets']
        return pd.DataFrame(buckets)
    except Exception as e:
        print(f"Error fetching log levels: {e}")
        return pd.DataFrame()

def fetch_top_error_groups(client, size=10):
    """Fetch top error groups."""
    query = {
        "size": size,
        "query": {"match_all": {}},
        "sort": [{"count": {"order": "desc"}}]
    }
    try:
        response = client.search(body=query, index="pega-analysis-results")
        hits = response['hits']['hits']
        data = []
        for hit in hits:
            source = hit['_source']
            display_rule = "N/A"
            if source.get('group_type') == "RuleSequence":
                sig = source.get("group_signature", "")
                first_part = sig.split('|')[0].strip()
                tokens = first_part.split('->')
                if len(tokens) >= 2:
                    display_rule = tokens[1]
            elif source.get('representative_log'):
                display_rule = source.get('representative_log', {}).get('logger_name', 'N/A')

            data.append({
                "Group Signature": source.get("group_signature"),
                "Count": source.get("count"),
                "Type": source.get("group_type"),
                "Rule Name": display_rule,
                "Diagnosis Status": source.get("diagnosis", {}).get("status", "N/A")
            })
        return pd.DataFrame(data)
    except Exception as e:
        print(f"Error fetching top groups: {e}")
        return pd.DataFrame()

def fetch_diagnosis_status_distribution(client):
    """Fetch distribution of diagnosis statuses."""
    try:
        query = {
            "size": 0,
            "aggs": {
                "statuses": {
                    "terms": {"field": "diagnosis.status", "size": 10}
                }
            }
        }
        res = client.search(index="pega-analysis-results", body=query)
        buckets = res['aggregations']['statuses']['buckets']
        return pd.DataFrame(buckets)
    except Exception as e:
        return pd.DataFrame()

def fetch_recent_errors(client):
    """Fetch recent errors trend."""
    query = {
        "size": 0,
        "query": {
            "match": {"log.level": "ERROR"}
        },
        "aggs": {
            "errors_over_time": {
                "date_histogram": {
                    "field": "ingestion_timestamp",
                    "fixed_interval": "1h" 
                }
            }
        }
    }
    try:
        response = client.search(body=query, index="pega-logs")
        buckets = response['aggregations']['errors_over_time']['buckets']
        data = [{"Time": b['key_as_string'], "Count": b['doc_count']} for b in buckets]
        return pd.DataFrame(data)
    except Exception as e:
        print(f"Error fetching recent errors: {e}")
        return pd.DataFrame()

def fetch_detailed_table_data(client, size=1000):
    """Fetch detailed data for the table."""
    query = {
        "size": size,
        "sort": [{"last_seen": {"order": "desc"}}]
    }
    try:
        response = client.search(body=query, index="pega-analysis-results")
        hits = response['hits']['hits']
        data = []
        for hit in hits:
            src = hit['_source']
            rep = src.get('representative_log', {})
            
            exc_sigs = src.get('exception_signatures', [])
            msg_sigs = src.get('message_signatures', [])
            
            display_exception = exc_sigs[0] if exc_sigs else rep.get('exception_message', 'N/A')
            if len(exc_sigs) > 1:
                display_exception += f" (+{len(exc_sigs)-1} others)"
            
            display_message = msg_sigs[0] if msg_sigs else rep.get('message', 'N/A')
            if len(msg_sigs) > 1:
                display_message += f" (+{len(msg_sigs)-1} others)"

            display_rule = "N/A"
            if src.get('group_type') == "RuleSequence":
                first_part = src.get('group_signature', '').split('|')[0].strip()
                tokens = first_part.split('->')
                if len(tokens) >= 2:
                    display_rule = tokens[1]
            
            data.append({
                "doc_id": hit['_id'],
                "last_seen": src.get('last_seen'),
                "group_signature": src.get('group_signature'),
                "group_type": src.get('group_type'),
                "count": src.get('count'),
                "diagnosis.status": src.get('diagnosis', {}).get('status', 'PENDING'),
                "display_rule": display_rule,
                "exception_summary": display_exception,
                "message_summary": display_message,
                "logger_name": rep.get('logger_name'),
                "diagnosis.report": src.get('diagnosis', {}).get('report')
            })
        df = pd.DataFrame(data)
        if not df.empty and 'last_seen' in df.columns:
            df['last_seen'] = pd.to_datetime(df['last_seen'], format='mixed')
        return df
    except Exception as e:
        print(f"Error fetching details: {e}")
        return pd.DataFrame()

def update_document_status(client, doc_id, new_status):
    """Update the diagnosis status of a document."""
    try:
        client.update(
            index="pega-analysis-results",
            id=doc_id,
            body={"doc": {"diagnosis": {"status": new_status}}}
        )
        return True
    except Exception as e:
        print(f"Error updating status: {e}")
        return False

def fetch_group_samples(client, group_id, max_samples=5):
    """Fetch sample raw logs for a group ID."""
    try:
        group_doc = client.get(index="pega-analysis-results", id=group_id)
        raw_ids = group_doc["_source"].get("raw_log_ids", [])
        
        if not raw_ids:
            return []
            
        target_ids = raw_ids[:max_samples]
        response = client.mget(index="pega-logs", body={"ids": target_ids})
        
        samples = []
        for doc in response.get("docs", []):
            if doc.get("found"):
                samples.append(doc["_source"])
        return samples
    except Exception as e:
        print(f"Error fetching samples: {e}")
        return []
