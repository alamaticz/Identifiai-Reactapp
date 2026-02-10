
import requests
import json
import sys

API_URL = "http://localhost:8000/api/chat"

# Mock context
mock_context = {
    "group_signature": "Activity: MyActivity -> DataTransform: Setup",
    "representative_log": {
        "message": "Start of context verification test",
        "exception_message": "NullPointerException in step 3"
    },
    "count": 5
}

payload = {
    "message": "What error is this?",
    "group_id": "test-group-id-123",
    "context": json.dumps(mock_context)
}

try:
    print(f"Sending request to {API_URL}...")
    response = requests.post(API_URL, json=payload)
    
    if response.status_code == 200:
        print("SUCCESS: Chat API responded correctly.")
        print("Response:", response.json())
    else:
        print(f"FAILURE: Chat API returned status {response.status_code}")
        print("Response:", response.text)
        sys.exit(1)

except Exception as e:
    print(f"ERROR: Could not connect to API: {e}")
    sys.exit(1)
