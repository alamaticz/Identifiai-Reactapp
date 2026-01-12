import traceback
try:
    print("Attempting to import ingest_pega_logs...")
    import ingest_pega_logs
    print("SUCCESS: ingest_pega_logs imported OK")
except Exception as e:
    print("FAILURE: Could not import ingest_pega_logs")
    traceback.print_exc()
