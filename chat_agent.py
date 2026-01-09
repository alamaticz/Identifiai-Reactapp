import os
import asyncio
from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.prebuilt import create_react_agent

# Load env variables if not already loaded
load_dotenv()

async def initialize_agent_executor(memory=None):
    """
    Initializes and returns an Agent connected to the OpenSearch MCP server using LangGraph.
    """
    mcp_url = os.getenv("MCP_SERVER_URL", "http://localhost:9900/sse")
    print(f"[DEBUG] MCP_SERVER_URL: {mcp_url}")
    
    mcp_server_config = {
        "opensearch": { 
            "url": mcp_url,
            "transport": "sse" if "/sse" in mcp_url else "stream",
            "headers": {
                "Content-Type": "application/json",
                "Accept-Encoding": "identity",
            }
        }
    }
    
    client = MultiServerMCPClient(mcp_server_config)
    tools = await client.get_tools() 
    
    if not tools:
        print("[WARNING] No tools found from MCP server. Agent will have limited capabilities.")

    model = ChatOpenAI(model="gpt-4o", streaming=True)
    
    system_prompt = (
        "You are a helpful Log Analysis Assistant. You have access to OpenSearch logs. "
        "IMPORTANT: Always check the index mapping using get_mapping or similar tools before performing any searches. "
        "Ensure you build syntactically correct OpenSearch DSL queries. "
        "When searching for errors or logs, ALWAYS search across 'log.message', 'exception_message', "
        "and 'log.exception.exception_message' fields."
    )

    agent = create_react_agent(
        model=model,
        tools=tools,
        prompt=system_prompt,
    )
    
    # We return a wrapper that has an 'ainvoke' method matching the expected API by server.py
    class AgentWrapper:
        def __init__(self, agent):
            self.agent = agent
        
        async def ainvoke(self, input_data):
            messages = []
            if "chat_history" in input_data:
                messages.extend(input_data["chat_history"])
            messages.append(("human", input_data["input"]))
            
            result = await self.agent.ainvoke({"messages": messages})
            last_msg = result["messages"][-1]
            return {"output": last_msg.content}

    return AgentWrapper(agent)