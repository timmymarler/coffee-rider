# Coffee Rider Web App

A web version of Coffee Rider built with React and Mapbox GL. This is a separate, independent application that shares the same Firebase backend as the mobile apps but uses web-specific libraries.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your Firebase and Mapbox credentials:
```bash
cp .env.example .env.local
```

Fill in the values:
- Firebase credentials (from Firebase console)
- Mapbox access token (from Mapbox)
- Google Maps API key
- Google Places API key

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

- 🗺️ Interactive map with Mapbox GL
- 🔐 Firebase authentication (login/register)
- ☕ Browse coffee places with filters
- 🛣️ Route planning and navigation
- 📍 Saved routes (when logged in)
- 👥 Groups support

## Architecture

This is a completely separate React application from the mobile apps. It:
- Uses the same Firebase project/database
- Shares no code with the React Native apps
- Can be deployed independently
- Never affects mobile builds

## Deployment

Ready to deploy to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

Build output is in the `dist/` folder.
