# Coffee Rider Web App

A web version of Coffee Rider built with React and Leaflet. This is a separate, independent application that shares the same Firebase backend as the mobile apps but uses web-specific libraries.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your Firebase credentials:
```bash
cp .env.example .env.local
```

Fill in the values from your Firebase Console → Project Settings:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

3. Start the development server:
```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Building for Production

```bash
npm run build
npm run preview
```

## Features

- 🗺️ Interactive map with Leaflet & OpenStreetMap
- 🔐 Firebase authentication (login/register)
- ☕ Browse coffee places with category filters
- 🛣️ Route planning and visualization
- 📍 Saved routes (when logged in)
- 👥 Groups support

## Architecture

This is a completely separate React application from the mobile apps. It:
- Uses the same Firebase project/database
- Shares no code with the React Native apps
- Can be deployed independently
- Never affects mobile builds

## Deployment

### Quick Start: Netlify (Recommended)

1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy automatically on every push

See [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) for detailed instructions.

### Other Options

- Vercel
- AWS S3 + CloudFront
- Any static hosting service

Build output is in the `dist/` folder.

## Future Enhancements

- Google Maps integration (for brand continuity with mobile apps)
- TomTom routing API (for advanced navigation)
- SendGrid integration for branded password reset emails
