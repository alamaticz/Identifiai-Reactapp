#!/usr/bin/env python3
"""
Deployment Helper Script
This script reads your .env file and generates the exact environment variables
you need to set in Render or Netlify.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

def main():
    # Load .env file
    env_path = Path(__file__).parent / '.env'
    
    if not env_path.exists():
        print("❌ Error: .env file not found!")
        print(f"   Expected location: {env_path}")
        return
    
    load_dotenv(env_path)
    
    print("=" * 70)
    print("🚀 IdentifAI 2.0 - Deployment Environment Variables")
    print("=" * 70)
    print()
    
    # Backend Environment Variables
    print("📦 BACKEND (Render) - Copy these to Render Dashboard:")
    print("-" * 70)
    
    backend_vars = {
        'OPENSEARCH_URL': os.getenv('OPENSEARCH_URL'),
        'OPENSEARCH_USER': os.getenv('OPENSEARCH_USER'),
        'OPENSEARCH_PASS': os.getenv('OPENSEARCH_PASS'),
        'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
    }
    
    for key, value in backend_vars.items():
        if value:
            # Mask sensitive values for display
            if 'PASS' in key or 'KEY' in key:
                display_value = value[:8] + '...' + value[-4:] if len(value) > 12 else '***'
            else:
                display_value = value
            print(f"  {key:20} = {display_value}")
        else:
            print(f"  {key:20} = ⚠️  NOT SET")
    
    print()
    print("💡 To set in Render:")
    print("   1. Go to your service → Environment")
    print("   2. Click 'Add Environment Variable'")
    print("   3. Copy each variable name and value from above")
    print()
    
    # Frontend Environment Variables
    print("-" * 70)
    print("⚛️  FRONTEND (Netlify) - Copy these to Netlify Dashboard:")
    print("-" * 70)
    print(f"  VITE_API_URL         = https://identifai-backend.onrender.com")
    print()
    print("💡 To set in Netlify:")
    print("   1. Go to Site settings → Environment variables")
    print("   2. Add: VITE_API_URL = https://identifai-backend.onrender.com")
    print("   3. Update the URL after deploying your backend")
    print()
    
    # Validation
    print("=" * 70)
    print("✅ Validation:")
    print("-" * 70)
    
    missing = [key for key, value in backend_vars.items() if not value]
    
    if missing:
        print(f"⚠️  Missing variables: {', '.join(missing)}")
        print("   Please set these in your .env file before deploying")
    else:
        print("✅ All required environment variables are set!")
    
    print()
    print("=" * 70)
    print("📚 Next Steps:")
    print("   1. Deploy backend to Render (set env vars from above)")
    print("   2. Copy your backend URL")
    print("   3. Deploy frontend to Netlify (set VITE_API_URL)")
    print("   4. Update CORS in server.py with your frontend URL")
    print()
    print("📖 Full guide: See deployment_guide.md")
    print("=" * 70)

if __name__ == '__main__':
    main()
