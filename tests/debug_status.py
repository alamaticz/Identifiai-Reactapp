
import os
from dotenv import load_dotenv
from opensearchpy import OpenSearch

load_dotenv()

def get_opensearch_client():
    OPENSEARCH_URL = os.getenv("OPENSEARCH_URL")
    OPENSEARCH_USER = os.getenv("OPENSEARCH_USER")
    OPENSEARCH_PASS = os.getenv("OPENSEARCH_PASS")
    
    if not OPENSEARCH_URL: print("No URL"); return None

    auth = (OPENSEARCH_USER, OPENSEARCH_PASS) if OPENSEARCH_USER else None
    
    return OpenSearch(
        hosts=[OPENSEARCH_URL],
        http_auth=auth,
        verify_certs=False,
        ssl_show_warn=False
    )

client = get_opensearch_client()
index_name = "pega-analysis-results"

if client.indices.exists(index=index_name):
    # Aggregation to find all unique status values
    query = {
        "size": 0,
        "aggs": {
            "statuses": {
                "terms": {"field": "diagnosis.status.keyword", "size": 100}
            }
        }
    }
    
    res = client.search(index=index_name, body=query)
    buckets = res['aggregations']['statuses']['buckets']
    
    print("Unique Statuses found in DB:")
    for b in buckets:
        print(f" - '{b['key']}': {b['doc_count']}")
        
    # Also fetch the document the user mentioned (if we can find it)
    print("\nSample doc with RESOLVED status:")
    sample = client.search(index=index_name, body={
        "size": 1,
        "query": {
            "match": {"diagnosis.status": "RESOLVED"} # Loose match
        }
    })
    for hit in sample['hits']['hits']:
        print(f"ID: {hit['_id']}")
        print(f"Status field: '{hit['_source'].get('diagnosis', {}).get('status')}'")

else:
    print(f"Index {index_name} does not exist.")
