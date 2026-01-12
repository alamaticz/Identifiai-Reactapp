import sys
import traceback

try:
    from fastapi import FastAPI, HTTPException, UploadFile, File, Form
    from pydantic import BaseModel
    from fastapi.middleware.cors import CORSMiddleware
    import os
    import pandas as pd
    from dotenv import load_dotenv
    import db_utils
    from ingest_pega_logs import ingest_file
    import tempfile
    import json
    import asyncio
    from datetime import datetime
    import time
    import subprocess

    # Conversational & Logic
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    import log_grouper # Assumes log_grouper.py is in the same directory
    import chat_agent
    from langchain_community.chat_message_histories import ChatMessageHistory

    load_dotenv(override=False)

    app = FastAPI()

    @app.get("/")
    async def root():
        return {"status": "success", "message": "IdentifAI Backend API is running"}

    @app.get("/ai")
    async def ai_root():
        return {"status": "success", "message": "AI Analysis Agent is active"}

    # Global agent executor store
    class ChatRequest(BaseModel):
        message: str

    agent_executor = None
    chat_histories = {} # Dict to store message history per "session" (simple implementation)

    @app.on_event("startup")
    async def startup_event():
        global agent_executor
        try:
            print("Initializing Chat Agent...")
            agent_executor = await chat_agent.initialize_agent_executor()
            print("Chat Agent initialized successfully.")
        except Exception as e:
            print(f"Failed to initialize Chat Agent: {e}")

    @app.post("/api/chat")
    async def chat_endpoint(request: ChatRequest):
        global agent_executor
        user_message = request.message
        
        if not agent_executor:
            # Try to initialize if it failed during startup
            try:
                agent_executor = await chat_agent.initialize_agent_executor()
            except Exception as e:
                raise HTTPException(status_code=503, detail=f"Chat Agent is not available: {str(e)}")

        try:
            # For simplicity, we use a single global history for now, 
            # but in a real app you'd use a session ID from the request.
            session_id = "default_session"
            if session_id not in chat_histories:
                chat_histories[session_id] = ChatMessageHistory()
            
            history = chat_histories[session_id]
            
            # Invoke agent
            response = await agent_executor.ainvoke({
                "input": user_message,
                "chat_history": history.messages
            })
            
            output = response["output"]
            
            # Save to history
            history.add_user_message(user_message)
            history.add_ai_message(output)
            
            return {
                "status": "success",
                "response": output
            }
        except Exception as e:
             print(f"Chat error: {e}")
             raise HTTPException(status_code=500, detail=str(e))

    # Enable CORS for frontend development and production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "https://*.netlify.app",  # Netlify preview deployments
            "https://identifai.netlify.app",  # Production Netlify URL (Old)
            "https://identifiai-reactapp.netlify.app", # Production Netlify URL (New)
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    client = db_utils.get_opensearch_client()

    @app.get("/api/status-options")
    async def get_status_options():
        # Return standard options + any existing statuses from data
        standard_options = ["PENDING", "IN PROCESS", "RESOLVED", "FALSE POSITIVE", "IGNORE", "COMPLETED"]
        try:
            df = db_utils.fetch_detailed_table_data(client)
            if not df.empty and 'diagnosis.status' in df.columns:
                existing = df['diagnosis.status'].dropna().unique().tolist()
                return list(dict.fromkeys(standard_options + existing))
        except:
            pass
        return standard_options

    @app.get("/api/type-options")
    async def get_type_options():
        # Define standard types matching the Streamlit app
        standard_types = ["Exception", "RuleSequence", "CSP Violation", "Logger", "Pega Engine Errors"]
        try:
            df = db_utils.fetch_detailed_table_data(client)
            if not df.empty and 'group_type' in df.columns:
                existing = df['group_type'].dropna().unique().tolist()
                # Combine standard types with any additional types from data
                return list(dict.fromkeys(standard_types + existing))
        except:
            pass
        return standard_types

    @app.post("/api/login")
    async def login(username: str = Form(...), password: str = Form(...)):
        if username == "alamaticz" and password == "Alamaticz#2024":
            return {"status": "success", "message": "Logged in successfully"}
        raise HTTPException(status_code=401, detail="Invalid credentials")

    @app.get("/api/metrics")
    async def get_metrics():
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        metrics = db_utils.calculate_summary_metrics(client)
        return metrics

    @app.get("/api/logs/details")
    async def get_log_details():
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        df = db_utils.fetch_detailed_table_data(client)
        return df.fillna('').to_dict(orient="records")

    @app.get("/api/analytics/log-levels")
    async def get_log_levels():
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        df = db_utils.fetch_log_level_distribution(client)
        return df.to_dict(orient="records")

    @app.get("/api/analytics/diagnosis-status")
    async def get_diagnosis_status():
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        df = db_utils.fetch_diagnosis_status_distribution(client)
        return df.to_dict(orient="records")

    @app.get("/api/analytics/top-errors")
    async def get_top_errors():
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        df = db_utils.fetch_top_error_groups(client, size=5)
        return df.to_dict(orient="records")

    @app.get("/api/analytics/trends")
    async def get_trends():
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        df = db_utils.fetch_recent_errors(client)
        return df.to_dict(orient="records")

    @app.post("/api/logs/update-status")
    async def update_status(doc_id: str = Form(...), status: str = Form(...)):
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        success = db_utils.update_document_status(client, doc_id, status)
        if success:
            return {"status": "success"}
        raise HTTPException(status_code=500, detail="Failed to update status")

    @app.get("/api/logs/group/{doc_id}")
    async def get_group_details(doc_id: str):
        if not client:
            raise HTTPException(status_code=500, detail="OpenSearch connection failed")
        try:
            # 1. Fetch the group document itself for metadata
            group_doc = client.get(index="pega-analysis-results", id=doc_id)
            group_data = group_doc["_source"]
            group_data["doc_id"] = doc_id # Ensure ID is included
            
            # 2. Fetch sample logs
            samples = db_utils.fetch_group_samples(client, doc_id)
            
            return {
                "group": group_data,
                "samples": samples
            }
        except Exception as e:
            # If mocking/dev mode or not found
            print(f"Error fetching group details: {e}")
            # Return mock data if real fetch fails (to keep UI working for dev)
            return {
                "group": {
                    "doc_id": doc_id,
                    "group_signature": "Mock Signature for " + doc_id,
                    "group_type": "Exception",
                    "count": 123,
                    "diagnosis": {
                        "status": "PENDING",
                        "report": "This is a mock diagnosis report because the backend fetch failed."
                    }
                },
                "samples": [
                    {
                        "log": {"message": "Mock log message 1"}, 
                        "exception_message": "NullPointerException", 
                        "stack_trace": ["line 1", "line 2"]
                    }
                ]
            }

    @app.post("/api/logs/upload")
    async def upload_logs(file: UploadFile = File(...)):
        try:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await file.read()
                tmp.write(content)
                tmp_path = tmp.name
            
            result = ingest_file(tmp_path)
            os.remove(tmp_path)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/analysis/trigger")
    async def trigger_analysis():
        """
        Triggers the Analysis_Diagnosis.py script as a subprocess.
        """
        try:
            # Run the script asynchronously or block - here we block for simplicity/result capture
            # In a production app, this should be a background task
            result = subprocess.run(["python", "Analysis_Diagnosis.py"], capture_output=True, text=True)
            
            if result.returncode == 0:
                return {
                    "status": "success",
                    "message": "Diagnosis Complete!",
                    "logs": result.stdout
                }
            else:
                 raise HTTPException(status_code=500, detail=f"Diagnosis Failed: {result.stderr}")
                 
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # --- Grouping Studio Logic ---

    def backup_analysis_status(client):
        """
        Backup current manual status from pega-analysis-results.
        Returns a dictionary: { doc_id : status }
        """
        print("Backing up analysis status...")
        backup = {}
        try:
            # Use scroll to fetch all
            query = {
                "_source": ["diagnosis.status"],
                "query": {"match_all": {}}
            }
            # Helpers.scan is cleaner, but for simplicity/speed in demo we can use a large size or scan
            # We'll use a simple search with size 10000 (assuming reasonable volume for demo)
            resp = client.search(index="pega-analysis-results", body={"size": 10000, "_source": ["diagnosis.status"], "query": {"match_all": {}}})
            
            for hit in resp['hits']['hits']:
                doc_id = hit['_id']
                status = hit['_source'].get('diagnosis', {}).get('status')
                if status and status != "PENDING":
                     backup[doc_id] = status
        except Exception as e:
            print(f"Backup failed (might be first run): {e}")
        return backup

    def restore_analysis_status(client, backup_data):
        """
        Restore status to new documents if their IDs match.
        """
        print(f"Restoring {len(backup_data)} status labels...")
        restored = 0
        if not backup_data:
            return 0
            
        # Bulk update would be better, but we'll do simple updates for prototype
        # Optimize: Check if ID exists first? No, just try update.
        
        for doc_id, status in backup_data.items():
            try:
                client.update(
                    index="pega-analysis-results",
                    id=doc_id,
                    body={"doc": {"diagnosis": {"status": status}}},
                    ignore=[404]
                )
                restored += 1
            except Exception:
                pass
        return restored

    class PatternGenerationRequest(BaseModel):
        examples: list[str]
        search_query: str = ""

    @app.post("/api/grouping/generate-pattern")
    async def generate_pattern(payload: PatternGenerationRequest):
        examples = payload.examples
        if not examples:
            raise HTTPException(status_code=400, detail="No examples provided")
        
        try:
            llm = ChatOpenAI(model="gpt-4o", temperature=0)
            
            # Fetch existing rules
            custom_patterns = []
            try:
                 response = client.search(index="pega-custom-patterns", body={"query": {"match_all": {}}, "size": 1000})
                 custom_patterns = [hit["_source"] for hit in response["hits"]["hits"]]
            except:
                 pass
            
            existing_rules_str = json.dumps(custom_patterns, indent=2) if custom_patterns else "[]"
            
            prompt = ChatPromptTemplate.from_template(
                """
                You are a regex expert for log grouping.
                
                **Task**:
                1. Analyze the following log signatures/messages (represented by {count} examples).
                2. Checks against these **EXISTING RULES**:
                {existing_rules}
                
                **Decision Logic**:
                - If the examples **match an existing rule** (or are a minor variation), suggest an **UPDATE** to that rule to cover these new cases.
                - If the examples represent a **completely new pattern**, suggest a **NEW** rule.
                
                **Input Examples**:
                {examples}
                
                Return strictly Valid JSON:
                {{
                    "action": "UPDATE" or "NEW",
                    "rule_name": "Name of the existing rule OR a descriptive new name",
                    "group_type": "The existing group category OR a new category",
                    "regex_pattern": "The UPDATED python regex (matching old + new) OR a completely NEW regex"
                }}
                
                **Rules**:
                1. If modifying an existing regex, ensure it still matches the original intent but is broad enough for the new logs.
                2. Use `.*` or `[\\d]+` for variable parts.
                3. Keep static parts exact.
                """
            )
            
            chain = prompt | llm | StrOutputParser()
            result_str = await chain.ainvoke({
                "count": len(examples), 
                "examples": "\n".join(examples),
                "existing_rules": existing_rules_str
            })
            
            # Cleanup JSON
            cleaned_json = result_str.replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned_json)
            
            return result
            
        except Exception as e:
            print(f"LLM Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    class SaveRuleRequest(BaseModel):
        name: str
        pattern: str
        group_type: str

    @app.post("/api/grouping/save-rule")
    async def save_rule(rule: SaveRuleRequest):
        try:
            doc_id = rule.name
            new_rule = {
                "name": rule.name,
                "pattern": rule.pattern,
                "group_type": rule.group_type,
                "created_at": datetime.utcnow().isoformat()
            }
            
            client.index(
                index="pega-custom-patterns",
                id=doc_id,
                body=new_rule,
                refresh=True
            )
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/grouping/apply")
    async def apply_grouping():
        """
        Triggers the re-grouping workflow:
        Backup -> Delete Index -> Run Grouper -> Restore Status
        """
        try:
            # 1. Backup
            backup = backup_analysis_status(client)
            
            # 2. Delete Index
            client.indices.delete(index="pega-analysis-results", ignore=[400, 404])
            
            # 3. Run Grouper
            # Running synchronously for now (careful with timeouts)
            # In production, use BackgroundTasks
            log_grouper.process_logs(ignore_checkpoint=True)
            
            # 4. Restore
            count = restore_analysis_status(client, backup)
            
            return {"status": "success", "restored_count": count}
            
        except Exception as e:
            print(f"Grouping workflow failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    if __name__ == "__main__":
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
except Exception as e:
    print("CRITICAL: Failed to import server.py")
    traceback.print_exc(file=sys.stdout)
    sys.exit(1)

