# Woodland Woodchuckers PWA — Local Setup & Zero-Cost Guide

A zero-cost, zero-credit-card progressive web app (PWA) for managing run schedules, member check-ins, and GPX routes using Vite, React, TypeScript, Leaflet, and the Firebase Spark plan.

---

## 1. Quickstart (Run Immediately With Zero Setup)

You can run and test the app immediately without any Firebase configuration or external accounts. The app defaults to an offline-first **Local Demo Mode** pre-loaded with realistic runs, members, badges, and GPX routes:

```bash
# Install dependencies (if not already done)
npm install

# Start Vite local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser!

---

## 2. Zero-Cost & Zero-Credit-Card Architecture

Every service and dependency in this stack is strictly free and does not require entering a credit card or billing information:

| Component | Free Technology | Why It's 100% Free |
| :--- | :--- | :--- |
| **Mapping & Tiles** | OpenStreetMap & Leaflet | Open-source map tiles without API keys, usage meters, or credit card requirements (unlike Google Maps or Mapbox). |
| **GPX Engine** | In-Browser XML DOM Parser | GPX tracks, Haversine distance, and elevation gain calculations run entirely in the browser using client compute. |
| **Database & Auth** | Google Firebase Spark Plan | Google's permanent free tier (50k Firestore reads/day, 20k writes/day, 1GB storage, email/guest Auth) with **zero credit card required**. |
| **Hosting & SSL** | Firebase Hosting or GitHub Pages | Free hosting with automated SSL certificate and custom domain support. |
| **Mobile App (PWA)** | Vite PWA & Service Workers | Installable directly to iOS/Android home screens without paying Apple or Google developer account fees ($99/yr or $25). |

---

## 3. Account Isolation: Setting up under woodlandwoodchuckers@gmail.com

To keep your club resources completely separated from your personal Google account:

### Step 3.1: Browser Setup (Firebase Console)
1. Open a new Chrome profile or private/incognito window.
2. Sign in with **`woodlandwoodchuckers@gmail.com`**.
3. Go to [Firebase Console](https://console.firebase.google.com/).
4. Click **Add project**:
   - Project Name: `woodland-woodchuckers` (or your preferred slug)
   - Billing Plan: Confirm the default **Spark (No-cost $0/mo)** plan. No credit card will ever be requested.
5. In the project dashboard, click the **Web (`</>`)** icon to register the web app.
6. Copy the configuration credentials into your local `.env` file:
   ```bash
   cp .env.example .env
   ```
7. In the Firebase Console left menu, navigate to **Build > Firestore Database** and click **Create Database**.

---

### Step 3.2: Terminal / CLI Sign-In
To ensure terminal deployments use the club email instead of any personal Google accounts:

```bash
# Authenticate CLI with woodlandwoodchuckers@gmail.com
npx -y firebase-tools@latest login
```
*(When your browser opens the Google sign-in window, choose **woodlandwoodchuckers@gmail.com**).*

Link your new project:
```bash
npx -y firebase-tools@latest use --add
```
*(Select your newly created `woodland-woodchuckers` project).*

Deploy rules and hosting:
```bash
# Deploy Firestore security rules
npx -y firebase-tools@latest deploy --only firestore:rules

# Deploy web app to Firebase free hosting
npx -y firebase-tools@latest deploy --only hosting
```

---

## 4. Production Build & Free Deployment

### Option A: Firebase Hosting (Recommended, Zero Cost)

Build the optimized web app:
```bash
npm run build
```

Deploy directly to your free Firebase Hosting subdomain (`your-project.web.app`):
```bash
npx -y firebase-tools@latest deploy --only hosting
```

### Option B: GitHub Pages

The built output in `dist/` can also be pushed to a `gh-pages` branch or deployed via GitHub Actions at zero cost.

---

## 5. PWA Mobile Installation

- **iOS (iPhone/iPad)**: Open the deployed website in Safari, tap the **Share** button, and tap **"Add to Home Screen"**.
- **Android**: Open in Chrome and tap the **"Install App"** prompt at the bottom of the screen.
- Runs work offline with full cached GPX routes!
