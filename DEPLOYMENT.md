# Deployment Guide - Pharmacy Management System

## Overview
This project has two parts:
- **Frontend** (React/Vite) - in `client/` folder
- **Backend** (Node.js/Express + SQLite) - in `server/` folder

Since the backend uses SQLite (file-based database) and file uploads, **Render is recommended** as it supports persistent disk storage.

---

## Option 1: Deploy on Render (Recommended)

### Step 1: Push to GitHub
Make sure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Deploy Backend on Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `pharmacy-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. Add **Environment Variables** (click "Advanced"):
   ```
   NODE_ENV=production
   JWT_SECRET=<generate-a-random-secret>
   GEMINI_API_KEY=<your-gemini-api-key>
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

6. **Add Disk** (Important for SQLite!):
   - Click **"Add Disk"**
   - Mount Path: `/var/data`
   - Size: 1 GB

7. Click **"Create Web Service"**

8. **Update your server.js** to use the disk path for production:
   ```javascript
   const dbPath = process.env.NODE_ENV === 'production' 
       ? '/var/data/pharmacy.db' 
       : path.join(__dirname, 'pharmacy.db');
   ```

### Step 3: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add **Environment Variable**:
   ```
   VITE_API_URL=https://pharmacy-api.onrender.com
   ```
   (Replace with your actual Render backend URL)

6. Click **"Deploy"**

### Step 4: Update CORS
After getting your Vercel URL, update the `FRONTEND_URL` environment variable in Render.

---

## Option 2: Deploy Both on Render

You can also use the `render.yaml` Blueprint file included:

1. Go to [render.com/dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will auto-detect the `render.yaml` file
5. Add your `GEMINI_API_KEY` in the environment variables
6. Deploy!

---

## Option 3: Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository

### Deploy Backend:
1. Configure: **Root Directory**: `server`
2. Add environment variables
3. Railway auto-detects Node.js and runs `npm start`

### Deploy Frontend:
1. Add another service from the same repo
2. **Root Directory**: `client`
3. Add `VITE_API_URL` pointing to your backend

---

## Environment Variables Summary

### Backend (server/)
| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | `production` or `development` | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `FRONTEND_URL` | Your frontend URL for CORS | Yes |

### Frontend (client/)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | Yes |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |

---

## Getting API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy and add to your environment variables

### Google OAuth (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID
4. Add authorized origins and redirect URIs

---

## Troubleshooting

### "Database file not found"
- Make sure you've added a disk in Render
- Update the database path for production (see Step 2.8 above)

### CORS errors
- Verify `FRONTEND_URL` matches your actual frontend domain
- Make sure to include `https://` in the URL

### Build failing
- Check Node.js version (needs >= 18)
- Make sure all dependencies are in `package.json`

### Tesseract not working
- The `eng.traineddata` file needs to be in the server folder
- Make sure it's committed to Git

---

## Quick Commands

```bash
# Local development
cd client && npm run dev     # Start frontend (port 5173)
cd server && npm start       # Start backend (port 3000)

# Build for production
cd client && npm run build   # Creates dist/ folder
```

---

## Your GitHub Repository
https://github.com/Mish-atul/test-dbms-repo

After making these changes, commit and push:
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

Then follow the Render or Vercel deployment steps above!
