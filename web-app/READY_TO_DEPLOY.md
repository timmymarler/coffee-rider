# Coffee Rider Web App - Netlify Deployment Ready ✅

## What's Been Prepared

### ✅ Configuration Files
- **`.env.example`** — Template with all required Firebase variables
- **`.npmrc`** — Handles React/Leaflet compatibility automatically  
- **`netlify.toml`** — Netlify build configuration (auto-detects this file)

### ✅ Dependencies
- All npm packages installed (`npm install` via `.npmrc`)
- Production build tested and verified (`npm run build` works)
- Output files in `dist/` folder ready to deploy

### ✅ Documentation
- **`NETLIFY_DEPLOYMENT.md`** — Step-by-step deployment guide
- **Updated `README.md`** — Now references Netlify as primary deployment method

### ✅ Build Verification
- Build succeeds with 206 KB main JavaScript file
- All assets generated correctly
- Routes configured for React Router (SPA support)

---

## Your Next Steps (In Order)

### 1️⃣ Create Netlify Account
- Visit [netlify.com → Sign Up](https://app.netlify.com/signup)
- Choose "GitHub" to connect (this is easiest)

### 2️⃣ Get Firebase Credentials
- Go to [Firebase Console](https://console.firebase.google.com)
- Select your Coffee Rider project
- Project Settings → Your Web App → Copy all 6 values:
  ```
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  ```

### 3️⃣ Connect GitHub to Netlify
1. In Netlify: **Add new site** → **Import from Git**
2. Authorize GitHub → Select your coffee-rider repo
3. Choose `main` branch
4. Netlify auto-detects `netlify.toml` — just click **Deploy**

### 4️⃣ Add Environment Variables in Netlify
1. Navigate to: **Site Settings** → **Build & Deploy** → **Environment**
2. Add those 6 Firebase variables from step 2
3. Click **Trigger Deploy** (top-right)

### 5️⃣ Wait for Build
- Watch the **Deploys** tab
- Should complete in ~30-60 seconds
- You'll get a temporary URL like `https://xxx-xxx-netlify.app`

### 6️⃣ Test It Works
- Visit your Netlify URL
- Try logging in with a test account
- Verify the map loads and shows places

### 7️⃣ Connect Your Domain
1. In Netlify: **Site Settings** → **Domain Management** → **Add Custom Domain**
2. Add `coffee-rider.co.uk`
3. Netlify provides DNS instructions (update at Hostinger)
4. Wait 24-48 hours for DNS propagation
5. SSL certificate auto-generated ✅

---

## Important Notes

- **`dist/` folder**: Contains your live website — don't delete
- **Don't commit `.env.local`**: It's in `.gitignore` (good!)
- **Automatic deployments**: Push to `main` branch = auto-deploy
- **Branching**: Create feature branches, test on Netlify preview URLs first

---

## Future: Google Maps + TomTom Integration

When you're ready (after launch or when needed):
1. Add API keys to `.env.example`
2. Add to Netlify environment variables  
3. Update Map component code
4. Deploy — same process

Minimal code changes needed. Tell me when you want to tackle this.

---

## Support

See `NETLIFY_DEPLOYMENT.md` for:
- Troubleshooting common issues
- Manual deployment (if Git isn't available)
- Detailed environment setup

---

**You're ready to launch! 🚀**

Once you set up Netlify and add the Firebase variables, your site will be live.
