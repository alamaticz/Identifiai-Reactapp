import traceback
try:
    print("Attempting to import log_grouper...")
    import log_grouper
    print("SUCCESS: log_grouper imported OK")
except Exception as e:
    print("FAILURE: Could not import log_grouper")
    traceback.print_exc()
