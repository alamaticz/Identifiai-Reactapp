import traceback
try:
    print("Attempting to import chat_agent...")
    import chat_agent
    print("SUCCESS: chat_agent imported OK")
except Exception as e:
    print("FAILURE: Could not import chat_agent")
    traceback.print_exc()
