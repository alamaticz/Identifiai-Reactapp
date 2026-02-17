
import requests
import sys

BASE_URL = "http://localhost:8000"

def trigger(endpoint):
    try:
        url = f"{BASE_URL}{endpoint}"
        print(f"Triggering {url}...")
        resp = requests.get(url, timeout=5)
        print(f"Tracking Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}...")
    except Exception as e:
        print(f"Error triggering {endpoint}: {e}")

if __name__ == "__main__":
    trigger("/api/metrics")
    trigger("/api/analytics/diagnosis-status")
