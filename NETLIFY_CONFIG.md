# Netlify Environment Configuration

## Required Environment Variable

You need to set the backend API URL in your Netlify dashboard:

### Steps:
1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add a new environment variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-render-backend-url.onrender.com`
   
   Replace `your-render-backend-url` with your actual Render service URL

### Example:
```
VITE_API_URL=https://identifai-backend.onrender.com
```

## After Setting the Variable

1. **Redeploy your site** on Netlify:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Clear cache and deploy site**

2. The frontend will now connect to your Render backend instead of localhost

## Verification

Open your browser's developer console (F12) and check:
- Network tab should show requests going to your Render URL
- No CORS errors
- Data should load properly

## Security Note

The backend CORS is currently set to allow all origins (`*`) for testing. After confirming everything works, you should update `server.py` to only allow your Netlify domain:

```python
allow_origins=["https://your-netlify-site.netlify.app"],
```
