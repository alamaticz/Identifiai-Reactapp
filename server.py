import os
import uvicorn
from fastapi import FastAPI, HTTPException, Form, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from fastapi import Request
from dotenv import load_dotenv
from opensearchpy import OpenSearch, helpers
import pandas as pd
import json
import asyncio
from datetime import datetime, timedelta
import traceback
from concurrent.futures import ThreadPoolExecutor


# Import existing modules
# Lazy imports to speed up startup
import extract_rule_sequences
# import Analysis_Diagnosis  <-- Moved to lazy import
# import chat_agent        <-- Moved to lazy import
# import log_grouper       <-- If needed for pattern generation

# Load environment variables
load_dotenv(override=True)

app = FastAPI(title="IdentifAI 2.0 API")

# CORS - Allow all origins for now (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins - update this with your Netlify URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenSearch Client
def get_opensearch_client():
    OPENSEARCH_URL = os.getenv("OPENSEARCH_URL")
    OPENSEARCH_USER = os.getenv("OPENSEARCH_USER")
    OPENSEARCH_PASS = os.getenv("OPENSEARCH_PASS")
    
    if not OPENSEARCH_URL: return None

    auth = (OPENSEARCH_USER, OPENSEARCH_PASS) if OPENSEARCH_USER else None
    
    return OpenSearch(
        hosts=[OPENSEARCH_URL],
        http_auth=auth,
        verify_certs=False,
        ssl_show_warn=False,
        timeout=30,  # Increased to 30 seconds for stability
        max_retries=1,
        retry_on_timeout=False
    )


client = get_opensearch_client()

# Simple in-memory cache for dashboard metrics
_cache = {}
CACHE_TTL = 30  # seconds

def get_cached_or_compute(cache_key, compute_func):
    """Simple cache helper with TTL"""
    now = datetime.utcnow()
    if cache_key in _cache:
        cached_data, cached_time = _cache[cache_key]
        if (now - cached_time).total_seconds() < CACHE_TTL:
            return cached_data
    
    result = compute_func()
    _cache[cache_key] = (result, now)
    return result

async def get_cached_or_compute_async(cache_key, compute_func):
    """Async cache helper with TTL"""
    now = datetime.utcnow()
    if cache_key in _cache:
        cached_data, cached_time = _cache[cache_key]
        if (now - cached_time).total_seconds() < CACHE_TTL:
            return cached_data
    
    result = await compute_func()
    _cache[cache_key] = (result, now)
    return result

# Startup event to pre-initialize connection
@app.on_event("startup")
async def startup_event():
    """Pre-initialize OpenSearch connection"""
    print("🚀 Starting IdentifAI 2.0 API...")
    if client:
        try:
            if client.ping():
                print("✅ OpenSearch connected")
            else:
                print("⚠️  OpenSearch connection failed")
        except Exception as e:
            print(f"⚠️  OpenSearch error: {e}")
    else:
        print("⚠️  OpenSearch client not initialized")
    print("✅ API ready")

# --- Endpoint Handlers ---



@app.get("/health")
def health_check():
    return {"status": "ok", "opensearch": client.ping() if client else False}

@app.get("/api/metrics")
async def get_metrics():
    import time
    start = time.time()
    
    if not client: return {}
    metrics = {
        "total_errors": 0,
        "total_errors_change": 0,
        "unique_issues": 0,
        "unique_issues_change": 0,
        "pending_issues": 0,
        "resolved_issues": 0,
        "most_frequent": "N/A",
        "last_incident": "N/A"
    }
    try:
        now = datetime.utcnow()
        last_week = now - timedelta(days=7)
        prev_week = now - timedelta(days=14)

        # Helper functions for parallel execution
        def get_total_errors():
            try:
                # Use count API for faster execution
                count = client.count(
                    index="pega-logs",
                    body={"query": {"match": {"log.level": "ERROR"}}}
                )["count"]
                return count
            except:
                return 0

        def get_error_change():
            # Skip this expensive calculation for now, return 0
            return 0

        def get_last_incident():
            try:
                # Use _source filtering to fetch only timestamp
                res = client.search(
                    index="pega-logs",
                    body={
                        "size": 1,
                        "_source": ["ingestion_timestamp"],
                        "query": {"match": {"log.level": "ERROR"}},
                        "sort": [{"ingestion_timestamp": {"order": "desc"}}]
                    }
                )
                if res['hits']['hits']:
                    return res['hits']['hits'][0]['_source'].get('ingestion_timestamp', "N/A")
                return "N/A"
            except:
                return "N/A"

        def get_unique_issues():
            try:
                # Direct count, no query needed
                count = client.count(index="pega-analysis-results")["count"]
                return count
            except:
                return 0

        def get_unique_change():
            # Skip this expensive calculation for now, return 0
            return 0

        def get_resolved_issues():
            try:
                count = client.count(
                    index="pega-analysis-results",
                    body={"query": {"terms": {"diagnosis.status": ["RESOLVED", "IGNORE"]}}}
                )["count"]
                return count
            except:
                return 0

        def get_most_frequent():
            try:
                # Fetch only group_signature field
                res = client.search(
                    index="pega-analysis-results",
                    body={
                        "size": 1,
                        "_source": ["group_signature"],
                        "sort": [{"count": {"order": "desc"}}]
                    }
                )
                if res['hits']['hits']:
                    sig = res['hits']['hits'][0]['_source'].get('group_signature', 'N/A')
                    return sig[:32] + "..." if len(sig) > 35 else sig
                return "N/A"
            except:
                return "N/A"

        # Execute in parallel using asyncio.to_thread
        results = await asyncio.gather(
            asyncio.to_thread(get_total_errors),
            asyncio.to_thread(get_error_change),
            asyncio.to_thread(get_last_incident),
            asyncio.to_thread(get_unique_issues),
            asyncio.to_thread(get_unique_change),
            asyncio.to_thread(get_resolved_issues),
            asyncio.to_thread(get_most_frequent)
        )

        metrics["total_errors"] = results[0]
        metrics["total_errors_change"] = results[1]
        metrics["last_incident"] = results[2]
        metrics["unique_issues"] = results[3]
        metrics["unique_issues_change"] = results[4]
        metrics["resolved_issues"] = results[5]
        metrics["most_frequent"] = results[6]

        # Pending Issues calculation (Unique - Resolved)
        u_issues = int(metrics["unique_issues"]) if metrics["unique_issues"] else 0
        r_issues = int(metrics["resolved_issues"]) if metrics["resolved_issues"] else 0
        metrics["pending_issues"] = u_issues - r_issues

    except Exception as e:
        print(f"Metrics global error: {e}")
        traceback.print_exc()
    
    elapsed = time.time() - start
    print(f"⏱️  get_metrics took {elapsed:.2f}s")
    return metrics

@app.get("/api/analytics/log-levels")
def get_log_levels():
    if not client: return []
    query = {"size": 0, "aggs": {"levels": {"terms": {"field": "log.level"}}}}
    try:
        res = client.search(body=query, index="pega-logs")
        buckets = res['aggregations']['levels']['buckets']
        # Frontend expects { key: 'ERROR', doc_count: 8500 }
        return buckets 
    except: return []

@app.get("/api/analytics/diagnosis-status")
def get_diagnosis_status():
    if not client: return []
    query = {"size": 0, "aggs": {"statuses": {"terms": {"field": "diagnosis.status", "size": 10}}}}
    try:
        res = client.search(body=query, index="pega-analysis-results")
        buckets = res['aggregations']['statuses']['buckets']
        return buckets
    except Exception as e:
        import traceback
        traceback.print_exc()
        return []

@app.get("/api/analytics/top-errors")
def get_top_errors():
    if not client: return []
    query = {"size": 5, "sort": [{"count": {"order": "desc"}}]}
    try:
        res = client.search(body=query, index="pega-analysis-results")
        data = []
        for h in res['hits']['hits']:
            source = h['_source']
            # Parse Rule Name for display
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
                "Group Signature": source.get('group_signature'),
                "Count": source.get('count'),
                "Rule Name": display_rule # Add this for frontend to prefer
            })
        return data
    except: return []

@app.get("/api/analytics/trends")
def get_trends():
    if not client: return []
    query = {
        "size": 0,
        "query": {"match": {"log.level": "ERROR"}},
        "aggs": {
            "errors_over_time": {
                "date_histogram": {"field": "ingestion_timestamp", "fixed_interval": "1h"}
            }
        }
    }
    try:
        res = client.search(body=query, index="pega-logs")
        buckets = res['aggregations']['errors_over_time']['buckets']
        return [{"Time": b['key_as_string'], "Count": b['doc_count']} for b in buckets]
    except: return []

@app.get("/api/dashboard/bulk-stats")
async def get_dashboard_bulk_stats():
    """
    Consolidated endpoint for dashboard stats to reduce frontend round-trips.
    Cached for 30 seconds to avoid redundant queries.
    """
    if not client: return {}
    
    async def compute_bulk_stats():
        return {
            "metrics": await get_metrics(),
            "log_levels": get_log_levels(),
            "diagnosis_status": get_diagnosis_status(),
            "top_errors": get_top_errors(),
            "trends": get_trends(),
            "status_options": get_statuses(),
            "type_options": get_types()
        }
    
    return await get_cached_or_compute_async("bulk_stats", compute_bulk_stats)

@app.get("/api/logs/details")
def get_log_details(
    size: int = 100, 
    offset: int = 0, 
    search: Optional[str] = None,
    sort_by: str = "count",
    sort_order: str = "desc",
    statuses: Optional[str] = None, # JSON list or comma separated
    types: Optional[str] = None
):
    if not client: return []
    
    # Create cache key from parameters
    cache_key = f"logs_{size}_{offset}_{search}_{sort_by}_{sort_order}_{statuses}_{types}"
    
    def compute_log_details():
        # Handle sort field mapping
        # For SORTING: Use .keyword subfields where available for performance
        # For FILTERING: Use base fields (diagnosis.status, group_type) - handled separately below
        sort_mapping = {
            "diagnosis.status": "diagnosis.status",  # keyword type, no subfield
            "group_signature": "group_signature",    # text only, sorting will be slower
            "group_type": "group_type",              # keyword type, no subfield
            "last_seen": "last_seen",
            "count": "count",
            "assigned_user": "assigned_user.keyword",  # has keyword subfield
            "display_rule": "representative_log.logger_name.keyword",  # has keyword subfield
            "message_summary": "representative_log.message.keyword",   # has keyword subfield
            "logger_name": "representative_log.logger_name.keyword",   # has keyword subfield
            "exception_summary": "representative_log.exception_message.keyword",  # has keyword subfield
            "diagnosis.report": "diagnosis.report.keyword"  # has keyword subfield
        }
        
        actual_sort_field = sort_mapping.get(sort_by, sort_by)
        order = sort_order.lower() if sort_order.lower() in ["asc", "desc"] else "desc"
        
        query_body = {
            "from": offset,
            "size": size, 
            "sort": [{actual_sort_field: {"order": order}}],
            "_source": [
                "last_seen", "group_signature", "group_type", "count",
                "diagnosis.status", "diagnosis.report", "assigned_user",
                "representative_log.logger_name", "representative_log.message",
                "representative_log.exception_message"
            ]
        }
        
        must_clauses = []
        
        if search:
            must_clauses.append({
                "query_string": {
                    "query": f"*{search}*",
                    "fields": ["group_signature", "group_type", "diagnosis.status", "representative_log.message", "representative_log.logger_name", "representative_log.exception_message"]
                }
            })
            
        if statuses:
            # Support both comma-separated and case-insensitive matching if possible, 
            # but for now we enforce UPPERCASE as the server returns them.
            status_list = [s.strip().upper() for s in statuses.split(",") if s.strip()]
            if status_list:
                must_clauses.append({"terms": {"diagnosis.status": status_list}})
            
        if types:
            type_list = [t.strip() for t in types.split(",") if t.strip()]
            if type_list:
                must_clauses.append({"terms": {"group_type": type_list}})
            
        if must_clauses:
            query_body["query"] = {"bool": {"must": must_clauses}}
        else:
            query_body["query"] = {"match_all": {}}

        try:
            res = client.search(body=query_body, index="pega-analysis-results")
            data = []
            for hit in res['hits']['hits']:
                src = hit['_source']
                rep = src.get('representative_log', {})
                # Helper logic for display strings
                exc = rep.get('exception_message', 'N/A')
                msg = rep.get('message', 'N/A')
                
                # Improved Display Rule Parsing
                display_rule = "N/A"
                if src.get('group_type') == "RuleSequence":
                     sig = src.get("group_signature", "")
                     first_part = sig.split('|')[0].strip()
                     tokens = first_part.split('->')
                     if len(tokens) >= 2:
                         display_rule = tokens[1]
                if display_rule == "N/A":
                    display_rule = rep.get('logger_name', 'N/A')

                data.append({
                    "doc_id": hit['_id'],
                    "last_seen": src.get('last_seen'),
                    "group_signature": src.get('group_signature'),
                    "group_type": src.get('group_type'),
                    "count": src.get('count'),
                    "diagnosis.status": src.get('diagnosis', {}).get('status', 'PENDING'),
                    "diagnosis.report": src.get('diagnosis', {}).get('report'),
                    "display_rule": display_rule,
                    "exception_summary": exc,
                    "message_summary": msg,
                    "logger_name": rep.get('logger_name', 'N/A'),
                    "assigned_user": src.get('assigned_user', 'Unassigned')
                })
            return data
        except Exception as e:
            print(f"Error in get_log_details: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    return get_cached_or_compute(cache_key, compute_log_details)

@app.post("/api/logs/update-status")
def update_status(doc_id: str = Form(...), status: str = Form(...), user: str = Form("Unknown")):
    if not client: raise HTTPException(503, "No DB")
    try:
        # Script update to set status AND append to audit_history
        script_source = """
            ctx._source.diagnosis.status = params.status;
            ctx._source.assigned_user = params.user;
            if (ctx._source.audit_history == null) {
                ctx._source.audit_history = [];
            }
            ctx._source.audit_history.add(params.entry);
        """
        
        # IST Timestamp
        ist_now = (datetime.utcnow() + pd.Timedelta(hours=5, minutes=30)).isoformat()
        
        audit_entry = {
            "timestamp": ist_now,
            "user": user,
            "action": "STATUS_CHANGE",
            "details": f"Changed status to {status}"
        }
        
        client.update(
            index="pega-analysis-results",
            id=doc_id,
            body={
                "script": {
                    "source": script_source,
                    "lang": "painless",
                    "params": {
                        "status": status,
                        "entry": audit_entry,
                        "user": user
                    }
                }
            }
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/logs/update-comments")
def update_comments(doc_id: str = Form(...), comments: str = Form(...), user: str = Form("Unknown")):
    if not client: raise HTTPException(503, "No DB")
    try:
        # Script update to set comments AND append to audit_history
        script_source = """
            ctx._source.comments = params.comments;
            if (ctx._source.audit_history == null) {
                ctx._source.audit_history = [];
            }
            ctx._source.audit_history.add(params.entry);
        """
        
        # IST Timestamp
        ist_now = (datetime.utcnow() + pd.Timedelta(hours=5, minutes=30)).isoformat()
        
        audit_entry = {
            "timestamp": ist_now,
            "user": user,
            "action": "COMMENT_UPDATE",
            "details": "Updated comments/notes"
        }
        
        client.update(
            index="pega-analysis-results",
            id=doc_id,
            body={
                "script": {
                    "source": script_source,
                    "lang": "painless",
                    "params": {
                        "comments": comments,
                        "entry": audit_entry
                    }
                }
            }
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/history")
def get_history(size: int = 100):
    if not client: return []
    try:
        query = {
            "size": size,
            "query": {
                "exists": {"field": "audit_history"}
            },
            "_source": ["audit_history", "group_signature"]
        }
        
        resp = client.search(index="pega-analysis-results", body=query)
        
        history_items = []
        for hit in resp['hits']['hits']:
            src = hit['_source']
            sig = src.get('group_signature', 'Unknown Group')
            audits = src.get('audit_history', [])
            
            for entry in audits:
                entry_flat = entry.copy()
                entry_flat['group_signature'] = sig
                history_items.append(entry_flat)
        
        # Sort by timestamp desc
        history_items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return history_items
            
    except Exception as e:
        print(e)
        return []

@app.get("/api/logs/group/{doc_id}")
def get_group_doc(doc_id: str):
    if not client: raise HTTPException(503, "No DB")
    try:
        doc = client.get(index="pega-analysis-results", id=doc_id)
        source = doc['_source']
        
        # Also need samples
        samples = []
        raw_ids = source.get("raw_log_ids", [])[:5]
        if raw_ids:
            try:
                mget = client.mget(index="pega-logs", body={"ids": raw_ids})
                samples = [d['_source'] for d in mget['docs'] if d['found']]
            except: pass
            
        return {
           "group": source, # Return full source to avoid missing fields
           "samples": samples,
           "context": get_analysis_diagnosis_module().construct_analysis_context(source)
        }
    except Exception as e:
        raise HTTPException(404, str(e))

# Lazy Loader Helper
def get_analysis_diagnosis_module():
    import Analysis_Diagnosis
    return Analysis_Diagnosis

@app.post("/api/analysis/diagnose/{doc_id}")
async def diagnose_single(doc_id: str, request: Request = None):
    """
    Trigger diagnosis for a single group.
    Accepts optional JSON body with 'pega_response' to include in context.
    """
    if not client: raise HTTPException(503, "No DB")
    
    pega_response = None
    if request:
        try:
            body = await request.json()
            pega_response = body.get('pega_api_response')
        except:
            pass

    try:
        # Run diagnosis function
        report, tokens = await get_analysis_diagnosis_module().diagnose_single_group(client, doc_id, pega_api_response=pega_response)
        if not report: 
            return {"success": False, "message": "Diagnosis returned empty."}
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/analysis/trigger")
async def trigger_analysis_global():
    # Calling Analysis_Diagnosis.run_diagnosis_workflow()
    # It runs a loop for pending items.
    try:
        # We can run it in background
        await get_analysis_diagnosis_module().run_diagnosis_workflow()
        return {"message": "Analysis workflow triggered successfully."}
    except Exception as e:
        raise HTTPException(500, str(e))
        
@app.get("/api/status-options")
def get_statuses():
    return ["PENDING", "IN PROCESS", "RESOLVED", "IGNORE", "DIAGNOSIS COMPLETED"]

@app.get("/api/type-options")
def get_types():
    return ["Exception", "RuleSequence", "CSP Violation", "Logger", "Pega Engine Errors", "LogMessage"]

class RuleExtractionRequest(BaseModel):
    content: str

@app.post("/api/extract-rules")
def extract_rules_endpoint(req: RuleExtractionRequest):
    """
    Extract rule sequence from raw stacktrace or text.
    Returns structured list and signature.
    """
    try:
        # Use extract_rule_sequence which returns list of tuples: [(type, class, name), ...]
        rules_tuples = extract_rule_sequences.extract_rule_sequence(req.content)
        
        # Convert tuples to dict format for frontend
        rules = [{'type': r[0], 'class': r[1], 'name': r[2]} for r in rules_tuples]
        
        # Generate signature: "Type->Name->Class | Type->Name->Class"
        signature_parts = []
        for idx, (rule_type, class_name, rule_name) in enumerate(rules_tuples, 1):
            part = f"{idx}:{rule_type}->{rule_name}->{class_name}"
            signature_parts.append(part)
        signature = " | ".join(signature_parts)
        
        # Get formatted text output
        formatted = extract_rule_sequences.format_rule_sequence(rules_tuples)
        
        return {
            "success": True, 
            "rules": rules,
            "signature": signature,
            "formatted": formatted
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))

# --- Pega API Proxy ---
class PegaRequest(BaseModel):
    payload: Dict[Any, Any]

@app.post("/api/pega/send")
async def send_to_pega_api(req: PegaRequest):
    """
    Proxy request to Pega API to avoid CORS issues and hide API URL.
    """
    import requests
    pega_api_url = os.getenv("PEGA_API_URL", "https://pdsllc-dt1.pegacloud.io/prweb/api/LogAnalyzerAPI/v1/ApplicationLogAnalyzer")
    
    try:
        # Pega API expects "request_Post" wrapped structure, which frontend should provide or we wrap here
        # Assuming frontend sends the full payload ready for Pega
        
        response = requests.post(
            pega_api_url,
            json=req.payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        try:
            return response.json()
        except:
            return {"status_code": response.status_code, "text": response.text}
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(503, f"Pega API Connection Error: {str(e)}")
    except Exception as e:
        raise HTTPException(500, str(e))

# Chat
class ChatRequest(BaseModel):
    message: str
    group_id: Optional[str] = None
    context: Optional[str] = None

@app.get("/api/notifications/recent")
async def get_recent_notifications():
    """
    Fetches important events from the last 24 hours:
    1. New ERROR logs in pega-logs.
    2. Recent Audit history entries in pega-analysis-results.
    """
    if not client: return []
    
    notifications = []
    try:
        now = datetime.utcnow()
        last_24h = now - timedelta(hours=24)
        
        # 1. Fetch recent ERROR logs
        log_query = {
            "size": 10,
            "sort": [{"ingestion_timestamp": "desc"}],
            "query": {
                "bool": {
                    "must": [{"match": {"log.level": "ERROR"}}],
                    "filter": [{"range": {"ingestion_timestamp": {"gte": last_24h.isoformat()}}}]
                }
            }
        }
        log_res = client.search(index="pega-logs", body=log_query)
        for hit in log_res['hits']['hits']:
            src = hit['_source']
            msg = src.get('log', {}).get('message', 'New Error Log')
            ts = src.get('ingestion_timestamp')
            notifications.append({
                "id": f"log_{hit['_id']}",
                "text": f"New Error: {msg[:100]}...",
                "time": ts,
                "type": "error"
            })

        # 2. Fetch recent Audit History
        # We search for docs that have audit entries in the last 24h
        # (Though audit_history timestamps are inside the array, we'll fetch docs and filter)
        audit_query = {
            "size": 10,
            "query": {
                "exists": {"field": "audit_history"}
            }
        }
        audit_res = client.search(index="pega-analysis-results", body=audit_query)
        for hit in audit_res['hits']['hits']:
            src = hit['_source']
            sig = src.get('group_signature', 'Group')
            audits = src.get('audit_history', [])
            for entry in audits:
                entry_ts_str = entry.get('timestamp', '')
                try:
                    entry_ts = datetime.fromisoformat(entry_ts_str.replace('Z', '+00:00'))
                    if entry_ts.replace(tzinfo=None) >= last_24h:
                        notifications.append({
                            "id": f"audit_{hit['_id']}_{entry_ts_str}",
                            "text": f"{entry.get('user', 'User')} {entry.get('action')}: {sig[:50]}...",
                            "time": entry_ts_str,
                            "type": "audit"
                        })
                except: continue

        # Sort combined notifications by time desc
        notifications.sort(key=lambda x: x['time'], reverse=True)
        return notifications[:15] # Return top 15 most relevant
        
    except Exception as e:
        print(f"Notifications error: {e}")
        return []

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        print(f"[DEBUG] Chat Request Received. Message: {req.message[:50]}...")
        if req.group_id and req.context:
            print(f"[DEBUG] Initializing Group Chat Agent. GroupID: {req.group_id}")
            # Contextual Chat
            import chat_agent
            executor = await chat_agent.initialize_group_chat_agent(req.group_id, req.context)
        else:
            print(f"[DEBUG] Initializing General Chat Agent.")
            # General Chat
            import chat_agent
            executor = await chat_agent.initialize_agent_executor()
            
        print(f"[DEBUG] Invoking Agent...")
        res = await executor.ainvoke({"input": req.message, "chat_history": []})
        print(f"[DEBUG] Agent Response: {str(res['output'])[:50]}...")
        return {"response": res["output"]}
    except Exception as e:
        print(f"[ERROR] Chat Endpoint Failed: {e}")
        traceback.print_exc()
        raise HTTPException(500, str(e))

@app.post("/api/grouping/generate-pattern")
async def generate_pattern(data: Dict[Any, Any]):
    """
    Generate a regex pattern for a given log sample using the LLM.
    """
    sample = data.get("sample", "")
    if not sample:
        raise HTTPException(400, "No sample provided")
        
    try:
        # Use Chat Agent to generate regex
        import chat_agent
        executor = await chat_agent.initialize_agent_executor()
        prompt = f"""
        You are a Regex Expert. 
        Create a flexible Python Regex to match this log error message, capturing variable parts (like IDs, timestamps) as wildcards.
        
        Log Sample:
        {sample}
        
        Output ONLY the raw regex pattern. No markdown. No explanations.
        """
        from langchain_core.messages import HumanMessage
        res = await executor.ainvoke({"input": prompt, "chat_history": []})
        pattern = res["output"].strip()
        
        # Clean up if LLM added backticks
        import re
        pattern = re.sub(r'^`+|`+$', '', pattern)
        
        return {
            "action": "NEW", 
            "rule_name": "Suggested Pattern", 
            "regex_pattern": pattern, 
            "group_type": "Custom"
        }
    except Exception as e:
        print(f"Pattern Gen Error: {e}")
        return {"action": "NEW", "rule_name": "Error Generating", "regex_pattern": ".*", "group_type": "Custom"}

@app.post("/api/grouping/save-rule")
def save_rule(data: Dict[Any, Any]):
    if not client: raise HTTPException(503, "No DB")
    try:
        # Index into pega-custom-patterns
        doc = {
            "name": data.get("rule_name"),
            "pattern": data.get("regex_pattern"),
            "group_type": "Custom",
            "created_at": datetime.utcnow().isoformat()
        }
        client.index(index="pega-custom-patterns", body=doc, refresh=True)
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))

def backup_analysis_status(client):
    """Backup diagnosis statuses before deletion (from dashboard.py)."""
    backup = {}
    try:
        query = {
            "size": 10000,
            "query": {
                "bool": {
                     "should": [
                        {"bool": {"must_not": {"term": {"diagnosis.status": "PENDING"}}}},
                        {"exists": {"field": "comments"}}
                     ],
                     "minimum_should_match": 1
                }
            }
        }
        res = client.search(index="pega-analysis-results", body=query)
        for hit in res['hits']['hits']:
            src = hit['_source']
            sig = src.get('group_signature')
            diag = src.get('diagnosis', {})
            comments = src.get('comments', "")
            
            if sig and (diag.get('status') != 'PENDING' or comments):
                backup[sig] = {
                    "diagnosis": diag,
                    "comments": comments
                }
        return backup
    except Exception as e:
        return {}

def restore_analysis_status(client, backup_data):
    """Restore diagnosis statuses (from dashboard.py)."""
    if not backup_data:
        return 0
    
    restored_count = 0
    try:
        query = {"query": {"match_all": {}}}
        scan = helpers.scan(client, index="pega-analysis-results", query=query)
        
        bulk_updates = []
        
        for doc in scan:
            doc_id = doc['_id']
            sig = doc['_source'].get('group_signature')
            
            if sig in backup_data:
                saved = backup_data[sig]
                # Handle old vs new format
                if "diagnosis" in saved:
                     diag_val = saved["diagnosis"]
                     comments_val = saved.get("comments", "")
                else:
                     diag_val = saved
                     comments_val = ""
                
                update_body = {"doc": {"diagnosis": diag_val, "comments": comments_val}}
                
                action = {
                    "_op_type": "update",
                    "_index": "pega-analysis-results",
                    "_id": doc_id,
                    "doc": update_body["doc"]
                }
                bulk_updates.append(action)
                restored_count += 1
        
        if bulk_updates:
            helpers.bulk(client, bulk_updates)
            
    except Exception as e:
        print(f"Restore failed: {e}")
        
    return restored_count

@app.post("/api/grouping/apply")
def apply_grouping():
    """
    Trigger re-grouping of logs based on new rules.
    SAFELY RESETS analysis results while preserving manual diagnoses.
    """
    try:
        if not client: raise HTTPException(503, "OpenSearch not connected")

        # 1. Backup
        backup_data = backup_analysis_status(client)
        
        # 2. Reset (Delete Index)
        if client.indices.exists(index="pega-analysis-results"):
            client.indices.delete(index="pega-analysis-results")
            
        # 3. Process (Synchronous)
        # Note: log_grouper must be imported
        import log_grouper
        log_grouper.process_logs(ignore_checkpoint=True)
        
        # 4. Restore
        restored = restore_analysis_status(client, backup_data)
        
        return {"success": True, "restored_count": restored}
    except Exception as e:
        raise HTTPException(500, f"Grouping workflow failed: {str(e)}")

@app.post("/api/logs/upload")
async def upload_logs(file: UploadFile = File(...)):
    """
    Upload and ingest logs using ingest_error_logs.py logic.
    Auto-triggers grouping on success.
    """
    try:
        import ingest_error_logs
        import log_grouper
        import shutil
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        # Ingest
        result = ingest_error_logs.ingest_file(tmp_path)
        
        # Cleanup
        os.remove(tmp_path)
        
        # Auto-Group
        if result.get("status") == "success":
            try:
                session_id = result.get("session_id")
                # Run grouping synchronously for this session so dashboard updates immediately
                log_grouper.process_logs(session_id=session_id, ignore_checkpoint=True)
                result["grouping_status"] = "completed"
            except Exception as e:
                print(f"Auto-grouping failed: {e}")
                result["grouping_status"] = "failed"
                result["grouping_error"] = str(e)
        
        return result
    except Exception as e:
        raise HTTPException(500, str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

