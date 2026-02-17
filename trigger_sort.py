import requests
import sys

try:
    print("Triggering sort by INVALID...")
    response = requests.get("http://localhost:8000/api/logs/details?sort_by=INVALID_KEY&sort_order=desc")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:200]}...")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Items returned: {len(data)}")
        if len(data) > 0:
            print(f"First item keys: {list(data[0].keys())}")
            print(f"First item count: {data[0].get('count')}")
    else:
        print("Request failed.")
        
except Exception as e:
    print(f"Error: {e}")
