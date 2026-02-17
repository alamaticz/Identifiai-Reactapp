import os
import json
import argparse
import re
from opensearchpy import OpenSearch, helpers
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER")
OPENSEARCH_PASS = os.getenv("OPENSEARCH_PASS")
SOURCE_INDEX = os.getenv("INDEX_NAME", "pega-logs")
ANALYSIS_INDEX = "pega-analysis-results"

def get_opensearch_client():
    if not OPENSEARCH_URL or not OPENSEARCH_USER or not OPENSEARCH_PASS:
        raise ValueError("OpenSearch credentials not found in .env file")
    
    auth = (OPENSEARCH_USER, OPENSEARCH_PASS)
    return OpenSearch(
        hosts=[OPENSEARCH_URL],
        http_auth=auth,
        verify_certs=False,
        ssl_show_warn=False,
        timeout=120
    )

def get_app_name(log_source):
    """
    Extracts application name strictly from log.app.
    Returns None if not found.
    """
    if not log_source:
        return None
        
    log_content = log_source.get("log", {})
    
    # Check log.app
    if "app" in log_content:
        return log_content["app"]
    
    return None

def extract_rule_info(stacktrace_line):
    """
    Extracts rule info from a stacktrace line using the pattern:
    (ra_action_pzbiincrementalindexerusingqp_030a605c1a7e1bec48386d1e0152becf.java:222)
    Copied from export_log_rules.py
    """
    pattern = r'\((ra_[a-z0-9]+_[a-zA-Z0-9_]+)\.java:\d+\)'
    match = re.search(pattern, stacktrace_line)
    
    if match:
        full_class_name = match.group(1)
        
        # Remove hash suffix (32 chars hex usually)
        # e.g. _030a605c1a7e1bec48386d1e0152becf
        name_without_hash = re.sub(r'_[a-f0-9]{32}.*$', '', full_class_name)
        # Also remove potential version suffixes like $2$1 if present
        name_without_hash = re.sub(r'\$\d+.*$', '', name_without_hash)

        parts = name_without_hash.split('_', 2)
        if len(parts) >= 3:
            # prefix = parts[0] # ra
            rule_type_code = parts[1] # action, stream, etc.
            rule_name = parts[2] # pzbiincrementalindexerusingqp
            
            # Map type code to human readable type
            type_map = {
                'action': 'Activity',
                'stream': 'Stream',
                'model': 'Data Transform',
                'section': 'Section',
                'harness': 'Harness',
                'flow': 'Flow',
                'activity': 'Activity'
            }
            
            rule_type = type_map.get(rule_type_code, rule_type_code.capitalize())
            
            result = {
                "class": full_class_name,
                "type": rule_type,
                "name": rule_name
            }
            return result
            
    return None

def process_groups(output_file="group_rule_sequences.json", limit=None):
    client = get_opensearch_client()
    print(f"Connected to OpenSearch at {OPENSEARCH_URL}")
    
    # Query for RuleSequence groups
    query = {
        "query": {
            "term": {
                "group_type": "RuleSequence"
            }
        }
    }
    
    print("Scanning groups...")
    groups = []
    
    # Use helpers.scan for efficient scrolling
    scanner = helpers.scan(
        client,
        query=query,
        index=ANALYSIS_INDEX,
        scroll="5m",
        size=500
    )
    
    count = 0
    batch_groups = []
    
    # Fields to remove
    fields_to_remove = [
        "first_seen", "last_seen", "message_signatures", 
        "count", "diagnosis", "raw_log_ids", "exception_signatures"
    ]
    
    try:
        for hit in scanner:
            group_source = hit["_source"]
            
            # Identify representative log ID BEFORE deleting fields
            rep_log_id = None
            if "representative_log" in group_source and "sample_log_id" in group_source["representative_log"]:
                rep_log_id = group_source["representative_log"]["sample_log_id"]
            elif "raw_log_ids" in group_source and group_source["raw_log_ids"]:
                rep_log_id = group_source["raw_log_ids"][0]
            
            # Remove unwanted fields
            for field in fields_to_remove:
                if field in group_source:
                    del group_source[field]
            
            if rep_log_id:
                batch_groups.append({
                    "group": group_source,
                    "log_id": rep_log_id
                })
            else:
                # No log ID to check, add without enrichment
                groups.append(group_source)
                
            count += 1
            if limit and count >= limit:
                break
            
            # Process in batches
            if len(batch_groups) >= 100:
                enrich_batch(client, batch_groups, groups)
                batch_groups = []
                print(f"Processed {len(groups)} groups...")
        
        # Process remaining
        if batch_groups:
            enrich_batch(client, batch_groups, groups)
            
    except Exception as e:
        print(f"Error during scan: {e}")
        
    print(f"Saving {len(groups)} enriched groups to {output_file}")
    with open(output_file, 'w') as f:
        json.dump(groups, f, indent=2)

def enrich_batch(client, batch_groups, groups_list):
    """
    Fetches raw logs for a batch and injects app name if found.
    Also extracts rule classes from the log stacktrace using logic from export_log_rules.py.
    """
    ids = [item["log_id"] for item in batch_groups]
    
    try:
        # Fetch log.app, log.exception, and exception (top level)
        response = client.mget(
            index=SOURCE_INDEX,
            body={"ids": ids},
            _source=["log.app", "log.exception", "exception", "log.message"]
        )
        
        log_map = {}
        for doc in response["docs"]:
            if doc.get("found"):
                log_map[doc["_id"]] = doc["_source"]
        
        for item in batch_groups:
            group = item["group"]
            log_id = item["log_id"]
            
            log_entry = log_map.get(log_id)
            if not log_entry:
                groups_list.append(group)
                continue

            # 1. App Name
            app_name = get_app_name(log_entry)
            if app_name:
                group["app"] = app_name
            
            # 2. Rule Classes
            # Logic from process_log_file in export_log_rules.py
            log_data = log_entry.get("log", {})
            message = log_data.get("message") or ""
            exception_data = log_data.get("exception")
            stacktrace = None
            
            if isinstance(exception_data, dict):
                stacktrace = exception_data.get("stacktrace")
            elif isinstance(exception_data, str):
                stacktrace = exception_data
            elif "exception" in log_entry:
                 # Top level exception fallback
                 stacktrace = log_entry["exception"]
            
            # If no stacktrace found, check top level string
            if not stacktrace and isinstance(log_entry.get("exception"), str):
                stacktrace = log_entry.get("exception")

            extracted_rules_map = {} # name -> class_name
            
            if stacktrace and isinstance(stacktrace, str):
                for st_line in stacktrace.split('\n'):
                    rule_info = extract_rule_info(st_line)
                    if rule_info:
                        # Map rule name to class
                        extracted_rules_map[rule_info["name"].lower()] = rule_info["class"]

            # Fallback: Extract from group_signature if available
            group_signature = group.get("group_signature")
            if group_signature:
                # Find all potential class names like ra_action_...
                # Matches patterns like ra_action_name_hash
                sig_pattern = r'\b(ra_[a-z0-9]+_[a-zA-Z0-9_]+)\b'
                # Use finditer to get all matches
                for match in re.finditer(sig_pattern, group_signature):
                    full_class_name = match.group(1)
                    
                    # Process similar to extract_rule_info but manually since structure differs
                    # Remove hash suffix (32 chars hex usually)
                    name_without_hash = re.sub(r'_[a-f0-9]{32}.*$', '', full_class_name)
                    name_without_hash = re.sub(r'\$\d+.*$', '', name_without_hash)

                    parts = name_without_hash.split('_', 2)
                    if len(parts) >= 3:
                        rule_name = parts[2] # pzbiincrementalindexerusingqp
                        # Map rule name to class
                        extracted_rules_map[rule_name.lower()] = full_class_name

            # 3. Enrich Group Rules
            if "rules" in group:
                for rule in group["rules"]:
                    rule_name = rule.get("name")
                    if rule_name:
                         rule_name_lower = rule_name.lower()
                         matched_class = None
                         
                         # Direct match
                         if rule_name_lower in extracted_rules_map:
                             matched_class = extracted_rules_map[rule_name_lower]
                         else:
                             # Suffix match
                             # Check if any extracted rule name ends with _rule_name
                             for extracted_name, full_class in extracted_rules_map.items():
                                 if extracted_name.endswith(f"_{rule_name_lower}"):
                                     matched_class = full_class
                                     break
                        
                         # Only assign the full class name if found
                         if matched_class:
                             rule["class"] = matched_class
                
                # Deduplicate rules by class name and filter out rules without class
                # Also remove type and name fields, keeping only class
                seen_classes = set()
                unique_rules = []
                for rule in group["rules"]:
                    class_name = rule.get("class")
                    if class_name and class_name not in seen_classes:
                        seen_classes.add(class_name)
                        # Store only the class field
                        unique_rules.append({"class": class_name})
                
                # Replace rules with deduplicated list containing only class names
                group["rules"] = unique_rules
            
            groups_list.append(group)
            
    except Exception as e:
        print(f"Error fetching batch logs: {e}")
        # Add original groups if fetch fails
        for item in batch_groups:
            groups_list.append(item["group"])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export Rule Sequences from Groups with App Name")
    parser.add_argument("--output", default="group_rule_sequences.json", help="Output JSON file")
    parser.add_argument("--limit", type=int, help="Limit number of groups to process (for testing)")
    
    args = parser.parse_args()
    
    process_groups(args.output, args.limit)