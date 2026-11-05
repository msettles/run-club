# 🦫 Woodland Woodchuckers Run Club PWA

> *"Pounding trails & pavement — one burrow at a time!"*

A zero-cost, zero-credit-card Progressive Web App (PWA) for managing run schedules, member check-ins, leaderboards, and GPX routes for the Woodland Woodchuckers Run Club.

![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)
![Firebase Spark](https://img.shields.io/badge/Firebase-Spark_Plan_(Free)-FFCA28?logo=firebase&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-OpenStreetMap-199900?logo=leaflet&logoColor=white)

---

## ✨ Features

- 🏃 **Run Schedules & RSVPs**: Browse upcoming group runs, view dates, times, surface types (Trail, Pavement, Mixed), and RSVP with one tap.
- ⏱️ **Pace Groups**: Clear pace brackets for every run (Fast Chucks, Steady Burrows, Cruiser Paws, Run/Walk).
- 📅 **Add to Calendar**: Instant one-click `.ics` calendar file export for Apple Calendar, Google Calendar, and Outlook.
- 🦫 **Digital Check-Ins**: Quick 1-tap check-in on run days with celebratory woodchuck confetti and attendance logging.
- 🏅 **Badges & Streaks**: Earn club awards (*First Chuck*, *Burrow Regular*, *Muddy Paws*, *Dawn Patrol*, *Half Centurion*).
- 🏆 **Club Leaderboards**: Track total runs, cumulative miles logged, and active streaks across all club members.
- 🗺️ **Interactive GPX Maps & Elevation Profiles**:
  - OpenStreetMap & OpenTopoMap layers (100% free, no Google Maps API keys or credit cards).
  - Elevation charts with interactive hover scrubbing directly linked to map markers.
  - Upload custom `.gpx` files exported from Garmin, Apple Watch, Strava, or AllTrails.
  - One-click GPX route download.
- 📱 **Progressive Web App (PWA)**: Installable on iOS and Android devices, offline-ready with service workers.
- 🔒 **Zero-Credit-Card Architecture**: Operates in local-first mode using browser storage by default, and seamlessly connects to a free Google Firebase Spark plan when cloud sync is desired.

---

## 🚀 Quickstart

```bash
# 1. Clone repository
git clone https://github.com-msettles/woodland_woodchuckers.git
cd woodland_woodchuckers

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` to start using the app immediately!

---

## 🛠️ Project Structure

```
woodland_woodchuckers/
├── public/
│   └── woodchuck.svg          # Club mascot vector icon
├── src/
│   ├── components/
│   │   ├── CheckInModal.tsx       # 1-tap run check-in with confetti & badges
│   │   ├── FirebaseSetupGuide.tsx # In-app zero-cost setup guide modal
│   │   ├── GpxUploader.tsx        # Drag-and-drop GPX parser & uploader
│   │   ├── Leaderboard.tsx        # Member rankings & badge showcase
│   │   ├── MapViewer.tsx          # Leaflet OpenStreetMap + elevation chart
│   │   ├── Navbar.tsx             # Header navigation & member switcher
│   │   ├── NewRunModal.tsx        # Schedule group run modal
│   │   └── RunCard.tsx            # Run event card & .ics export
│   ├── data/
│   │   └── initialData.ts         # Pre-seeded sample runs, routes & members
│   ├── services/
│   │   ├── firebase.ts            # Firebase Spark SDK initialization
│   │   └── storage.ts             # LocalStorage & Firestore sync store
│   ├── types/
│   │   └── index.ts               # TypeScript data models
│   ├── utils/
│   │   └── gpxParser.ts           # XML GPX parser & Haversine distance engine
│   ├── App.tsx                    # Main app container & tab routing
│   ├── index.css                  # Tailwind directives & Leaflet styling
│   └── main.tsx                   # App entrypoint
├── firebase.json              # Firebase Hosting & Firestore configuration
├── firestore.rules            # Firestore security rules
├── setup.md                   # Complete local setup & Firebase guide
├── tailwind.config.js         # Custom earthy woodchuck palette
└── vite.config.ts             # Vite configuration with PWA plugin
```

---

## 📜 License

MIT License. Designed with ❤️ for the Woodland Woodchuckers community.
