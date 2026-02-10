# Render Deployment Configuration

## Build Command
```bash
pip install -r requirements.txt
```

## Start Command
```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

## Environment Variables
Make sure to set these in your Render dashboard:

### Required
- `OPENSEARCH_URL` - Your OpenSearch instance URL
- `OPENSEARCH_USER` - OpenSearch username (if authentication is enabled)
- `OPENSEARCH_PASS` - OpenSearch password (if authentication is enabled)
- `OPENAI_API_KEY` - Your OpenAI API key for LangChain

### Optional
- `PORT` - Automatically set by Render, defaults to 10000

## CORS Configuration
The server is currently configured to allow these origins:
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:3000`

**Important**: You'll need to update the CORS origins in `server.py` to include your frontend's deployed URL once you deploy it.

### Update CORS in server.py (lines 29-35):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://your-frontend-url.onrender.com"  # Add your deployed frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Deployment Steps
1. ✅ Push code to GitHub (completed)
2. ✅ Update `requirements.txt` with all dependencies (completed)
3. Connect your GitHub repository to Render
4. Set environment variables in Render dashboard
5. Deploy!

## Troubleshooting
If deployment still fails, check:
- All environment variables are set correctly
- OpenSearch instance is accessible from Render's servers
- Build logs for any missing system dependencies
