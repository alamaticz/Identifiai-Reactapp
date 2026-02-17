import requests
import sys

try:
    print("Triggering sort by count ASC...")
    response = requests.get("http://localhost:8000/api/logs/details?sort_by=count&sort_order=asc")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:200]}...")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Items returned: {len(data)}")
    else:
        print("Request failed.")
        
except Exception as e:
    print(f"Error: {e}")
