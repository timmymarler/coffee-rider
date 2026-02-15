# Netlify Deployment Guide

This guide walks you through deploying Coffee Rider Web App to Netlify.

## Prerequisites

- Netlify account (free tier is sufficient) — [Sign up here](https://netlify.com)
- GitHub account with this repository (Netlify deploys from Git)
- Firebase project ID and credentials
- Coffee Rider domain (coffee-rider.co.uk)

## Step 1: Prepare Your Code

### 1.1 Environment Variables

Create a `.env.local` file locally (this is in `.gitignore`, so it won't commit):

```bash
cp .env.example .env.local
```

Fill in your Firebase credentials:
```
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

Find these values in your Firebase Console → Project Settings → Your Web App.

### 1.2 Test Locally

```bash
npm install --legacy-peer-deps
npm run dev
```

Visit `http://localhost:3000` and test login/features.

### 1.3 Build & Preview

```bash
npm run build
npm run preview
```

Verify the production build runs correctly.

## Step 2: Connect to Netlify

### 2.1 Via Git (Recommended)

1. **Push your code to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push origin main
   ```

2. **Log in to Netlify** and click **"Add new site"**

3. **Choose "Import from Git"** → Select GitHub → Authorize

4. **Select your repository** → Choose branch (`main`)

5. **Build settings:**
   - Build command: `npm install --legacy-peer-deps && npm run build`
   - Publish directory: `dist`
   - Node version: `20`
   
   (Or just click "Deploy" — Netlify auto-detects from `netlify.toml`)

6. Click **"Deploy"** and wait for the build to complete

### 2.2 Manual Deploy (Alternative)

If not using Git:

```bash
npm install -g netlify-cli
netlify init
netlify deploy --prod --dir=dist
```

## Step 3: Configure Environment Variables

1. **In Netlify Dashboard** → Your Site Settings → **Build & Deploy** → **Environment**

2. **Add each variable from `.env.example`:**
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

3. **Trigger a new deployment:**
   - Push a commit to your repo, OR
   - Dashboard → **Deploys** → **Trigger deploy**

## Step 4: Configure Your Domain

### 4.1 Point Domain to Netlify

1. **Get your Netlify domain** or use a custom domain
   - Find it in **Site Settings** → **Domain management**

2. **Update your DNS at Hostinger** (or wherever domain is registered):
   - Add Netlify nameservers or CNAME record
   - Netlify provides exact instructions in **Domain management**

3. **Verify domain** in Netlify dashboard (usually takes 24-48 hours)

### 4.2 SSL Certificate

Netlify auto-generates free HTTPS certificate via Let's Encrypt. No action needed.

## Step 5: Troubleshooting

### Build Fails With "ERESOLVE"
This is okay — we're using `--legacy-peer-deps` for React/Leaflet compatibility.

### Site says "Not Found" for routes
**Already fixed** — `netlify.toml` has redirect rules for React Router.

### Firebase calls failing
Check that **environment variables are set** in Netlify dashboard (Step 3).

### 206 KB JavaScript file warning
This is from Leaflet + React. Not a blocker. We can optimize later if needed.

## Deploying Updates

After initial setup, just:
```bash
git commit -m "Your changes"
git push origin main
```

Netlify automatically rebuilds and deploys.

---

## Future: Google Maps + TomTom Integration

When ready to add Google Maps/Places + TomTom APIs:

1. Add keys to `.env.example`
2. Add to Netlify environment variables
3. Update Map component to use Google Maps SDK
4. Update routing logic to use TomTom API

Minimal code changes — structure stays the same.

---

## Next Steps

1. Create Netlify account
2. Connect GitHub repo
3. Add Firebase environment variables
4. Verify deployment
5. Update coffee-rider.co.uk DNS

Then you're live! 🚀
