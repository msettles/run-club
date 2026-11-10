# Woodland Woodchuckers Run Club
## Brand Identity, Color Palette, Typography & Implementation Log

*Official Design System & Media Asset Documentation*  
*In Partnership with Blue Note Brewing Co. • Woodland, California*

---

## 1. Mascot & Heritage: The Woodchucker Story

The Woodland Woodchuckers Run Club brings together community runners, trail enthusiasts, and craft beer lovers in Woodland, CA. The visual identity bridges the club's brewery roots with its modern athletic community.

### Mascot Evolution

```
   ┌─────────────────────────────────────────────────────────┐
   │                  WOODCHUCKER HERITAGE                   │
   ├────────────────────────────┬────────────────────────────┤
   │  Woodchucker 2 (Original)  │   Woodchucker 2026 (New)   │
   ├────────────────────────────┼────────────────────────────┤
   │ • Blue Note bottle cap     │ • Active running mascot    │
   │ • Woodchuck face emblem    │ • Full-body sprinting form │
   │ • Dual brewing hops        │ • Frosty craft beer mug    │
   │ • Vintage arched banners   │ • "Run Crew" dynamic arch  │
   │ • Deep marine teal (#1A607C│ • Transparent line-art     │
   └────────────────────────────┴────────────────────────────┘
```

#### 1. Woodchucker 2 — The Original Bottle Cap Logo (`/Woodchucker2.jpg`)
* **Context**: The foundational club emblem created in collaboration with Blue Note Brewing Co.
* **Composition**: A circular bottle cap silhouette featuring crimped ridges, curved upper banner ("WOODLAND"), central woodchuck face flanked by two hop cones, lower arched ribbon ("WOODCHUCKERS"), and central crest text ("BLUE NOTE BREWING CO.").
* **Colors**: Signature deep marine teal background (`#1A607C`), crisp graphic black (`#000000`), and warm alabaster cream (`#FAF2EE`).
* **Ideal Applications**: Circular stickers, pint glasses, coasters, app icons, medals, and embroidery patches.

#### 2. Woodchucker 2026 — The Official Run Crew Mascot (`/Woodchucker2026.png`)
* **Context**: The new 2026 seasonal mascot designed specifically for the running crew.
* **Composition**: An energetic sprinting woodchuck with running shorts and sneakers, wearing a branded Blue Note Brewing Co. tank top (est. 2018), triumphantly raising a frosty mug of craft beer with head foam, enclosed by an athletic circular typographic arc: **"WOODLAND Run Crew WOODCHUCKERS"**.
* **Format**: High-contrast, transparent PNG with clean alpha channel.
* **Ideal Applications**: Running singlets, technical race tees, event bibs, trucker hats, water bottles, and social media graphics.

---

## 2. Color Palette Specification

The club's color scheme is anchored on the deep marine teal (`#1A607C`) extracted from the original bottle cap logo, complemented by warm craft beer amber and vintage alabaster cream neutrals.

### Core Brand Colors

| Swatch | Color Name | HEX | RGB | HSL | Role / Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| ![#1A607C](https://placehold.co/15x15/1A607C/1A607C.png) | **Blue Note Teal** | `#1A607C` | `26, 96, 124` | `197°, 65%, 29%` | **Primary Brand Anchor** — The original bottle cap background; primary buttons, navbar accents, headers, and GPX track lines. |
| ![#DE9C1E](https://placehold.co/15x15/DE9C1E/DE9C1E.png) | **Craft Amber Gold** | `#DE9C1E` | `222, 156, 30` | `39°, 76%, 49%` | **Energy / Accent** — Craft beer foam, mascot cheeks, active run streaks, and finish markers. |
| ![#FAF2EE](https://placehold.co/15x15/FAF2EE/FAF2EE.png) | **Alabaster Cream** | `#FAF2EE` | `250, 242, 238` | `20°, 55%, 96%` | **Vintage Off-White** — Woodchuck snout and banner ribbon fill; warm card surface tint. |
| ![#0D1113](https://placehold.co/15x15/0D1113/0D1113.png) | **Bottle Cap Midnight** | `#0D1113` | `13, 17, 19` | `200°, 19%, 6%` | **Graphic Ink** — Sharp line-art borders, dark text, high-contrast modal headers. |
| ![#EDF7FA](https://placehold.co/15x15/EDF7FA/EDF7FA.png) | **Marine Tint** | `#EDF7FA` | `237, 247, 250` | `192°, 52%, 95%` | **UI Light Surface** — App background highlights, badge containers, and PWA surface. |

---

### Tailwind CSS Color Scale (`woodland` & `bluenote`)

```javascript
colors: {
  woodland: {
    50:  '#edf7fa', // Lightest tint: badge backgrounds, hover surfaces
    100: '#d4ebf2', // Soft accent: surface chips, active row background
    200: '#aedce8', // Border subtle: dividers, card borders
    300: '#7bc3d7', // Focus rings, secondary icon accents
    400: '#3ea4c1', // Vibrant cyan-teal: chart gradients, hover state
    500: '#1a607c', // PRIMARY BRAND ANCHOR: buttons, key branding
    600: '#155169', // Interactive hover: button hover, dark badges
    700: '#134358', // High-contrast text on light backgrounds (WCAG AAA)
    800: '#113748', // Dark card containers, header bars
    900: '#0e2e3d', // Midnight hero gradient start
    950: '#071d27', // Deepest midnight border
  },
  woodchuck: {
    50:  '#fdfaf0',
    100: '#faf0d3',
    200: '#f5dfa3',
    300: '#eec86c',
    400: '#e5a837',
    500: '#de9c1e', // CRAFT BEER GOLD / MASCOT ACCENT
    600: '#bc6c11',
    700: '#974e11',
    800: '#7c3d14',
    900: '#683415',
    950: '#3d1b06',
  }
}
```

---

### Contrast & Accessibility (WCAG 2.1)

| Element Pair | Foreground | Background | Contrast Ratio | Compliance |
| :--- | :---: | :---: | :---: | :---: |
| White Text on Primary Teal | `#FFFFFF` | `#1A607C` | **6.1:1** | **WCAG AA / AAA Large** |
| Deep Teal Text on White | `#134358` | `#FFFFFF` | **9.2:1** | **WCAG AAA** |
| Ink Black on Cream | `#0D1113` | `#FAF2EE` | **16.8:1** | **WCAG AAA** |
| Dark Text on Amber Gold Button | `#0D1113` | `#DE9C1E` | **8.4:1** | **WCAG AAA** |

---

## 3. Typography & Font System

The typography marries traditional craft brewing packaging with modern athletic sports design.

### Google Fonts Pairings

```
1. DISPLAY & HEADINGS: Oswald
   Weights: 500 (Medium), 600 (SemiBold), 700 (Bold)
   Classification: Condensed Grotesque Display Sans-Serif
   Character: Arched banner lettering, uppercase athletic titles, event names.
   Sample: "WOODLAND WOODCHUCKERS RUN CLUB"

2. ATHLETIC SCRIPT & ACCENTS: Outfit
   Weights: 600 (SemiBold), 700 (Bold), 800 (ExtraBold), 900 (Black)
   Classification: Geometric Sport Display
   Character: "Run Crew" dynamic script punch, mileage counts, runner streaks.
   Sample: "Spring 2026 Season • 100% Free"

3. INTERFACE & BODY: Plus Jakarta Sans
   Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
   Classification: Modern Geometric Workhorse Sans
   Character: Route descriptions, GPX elevation stats, check-in modals.
   Sample: "Pounding trails & pavement — one burrow at a time!"
```

### Web Font Implementation

In `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
  rel="stylesheet"
/>
```

In `tailwind.config.js`:
```javascript
fontFamily: {
  sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  display: ['"Oswald"', 'ui-sans-serif', 'sans-serif'],
  sport: ['"Outfit"', 'ui-sans-serif', 'sans-serif'],
}
```

---

## 4. Logo Assets & Media Inventory

Both logos are bundled directly in `/public` for instant offline PWA access and high-speed delivery.

| Asset File | Format | Dimensions | Alpha Channel | Primary Use Case |
| :--- | :---: | :---: | :---: | :--- |
| `public/Woodchucker2026.png` | PNG | 468 × 355 px | **Yes (Cutout)** | **New 2026 Mascot**: Navbar badge, singlets, tech shirts, race bibs, stickers, Hero mascot showcase. |
| `public/Woodchucker2.jpg` | JPEG | 960 × 960 px | No (Teal Fill) | **Original Heritage Badge**: Bottle cap emblem, pint glasses, circular stickers, social media avatars, PWA icons. |
| `public/woodchuck.svg` | SVG | Vector 100×100 | Yes (Vector) | Notification icon, vector badge. |
| `public/runclub-icon.png` | PNG | 96 × 96 px | Yes | **Run Club platform mark** (not club branding): browser tab icon and the footer's "Built with Run Club" credit. Cropped from `runclub.png`. |
| `public/runclub.png` | PNG | 936 × 624 px | Yes | **Run Club platform logo** with wordmark (README header). |
| `public/pwa-512x512.png` | PNG | 512 × 512 px | No (Square) | Android splash screen & high-density home screen icon. |
| `public/pwa-192x192.png` | PNG | 192 × 192 px | No (Square) | Mobile home screen shortcut icon. |
| `public/apple-touch-icon.png` | PNG | 180 × 180 px | No (Square) | iOS Safari "Add to Home Screen" app icon. |
| `public/favicon.ico` | ICO | 32 × 32 px | No (Square) | Desktop browser tab icon. |

---

### Merch & Print Guidelines

* **Singlets & Tech Shirts (Light Garments)**:
  * Print `Woodchucker2026.png` in solid black ink or `#0D1113`.
  * Position: Front chest center (8"–10" width) or left chest pocket (3.5" width).
* **Technical Hoodies & Dark Garments**:
  * Reverse `Woodchucker2026.png` line-art to pure white (`#FFFFFF`) with amber beer foam (`#DE9C1E`).
* **Die-Cut Stickers**:
  * For bottle cap: Circle die-cut around `Woodchucker2.jpg` outer ridges.
  * For 2026 runner: Contour die-cut around `Woodchucker2026.png` with 1/8" white border bleed.
* **Strava & Social Media Profiles**:
  * Use `Woodchucker2.jpg` (centered 1:1 square) for high recognition in club feeds.

---

## 5. Webapp Implementation & Changelog

### Phase 1: Color Palette & Design System
* **`tailwind.config.js`**:
  * Created complete `woodland` (and `bluenote`) 50–950 color scale based on `#1A607C`.
  * Added `woodchuck` craft amber palette (`#DE9C1E`), `brand` neutral tokens (`cream`, `ink`, `teal`, `gold`).
  * Aliased `emerald` to `woodland` for seamless backwards compatibility across components.
  * Added custom `fontFamily` definitions for `sans`, `display` (Oswald), and `sport` (Outfit).
* **`index.html`**:
  * Updated theme color meta tag from `#2c5e27` to `#1a607c`.
  * Added Google Fonts preconnect and stylesheets for Oswald, Outfit, and Plus Jakarta Sans.
  * Updated body selection highlight to `selection:bg-woodland-500 selection:text-white`.
* **`vite.config.ts`**:
  * Updated PWA manifest `theme_color` to `#1a607c` and `background_color` to `#edf7fa`.
  * Added `Woodchucker2.jpg` and `Woodchucker2026.png` to offline precache assets.

### Phase 2: Icon Generation & Vector Refinement
* Generated missing high-resolution PWA icons from the official bottle cap logo:
  * `public/pwa-512x512.png` (512×512)
  * `public/pwa-192x192.png` (192×192)
  * `public/apple-touch-icon.png` (180×180)
  * `public/favicon.ico` (32×32)
* Updated `public/woodchuck.svg`:
  * Replaced previous green gradient with `#1A607C` Blue Note Teal and `#DE9C1E` Craft Beer Amber headband stripe.

### Phase 3: Component Restyling & Brand Integration
* **`src/App.tsx`**:
  * Upgraded Hero banner with a rich teal gradient (`from-woodland-950 via-woodland-900 to-[#13495d]`).
  * Added dual-logo interactive showcase in the Hero banner displaying both the **2026 Mascot** and the **Heritage Badge**.
  * Integrated Oswald display headings and Outfit sport badges.
  * Added "Club Logos & Colors" quick button opening the Brand Assets Modal.
* **`src/components/Navbar.tsx`**:
  * Replaced generic SVG with the official 2026 Run Crew Mascot (`Woodchucker2026.png`).
  * Added "Logos" button triggering the Brand Assets Modal.
* **`src/components/BrandAssetsModal.tsx`**:
  * Created an interactive brand guide modal displaying both official logos side-by-side.
  * One-click download buttons for transparent PNG (`Woodchucker2026.png`) and high-res JPG (`Woodchucker2.jpg`).
  * Interactive swatches with 1-click clipboard HEX code copy.
  * Typography specimen previews and merch printing guidelines.
* **`src/components/MapViewer.tsx`**:
  * Replaced green Leaflet polyline with `#1A607C` Blue Note Teal (weight: 5, opacity: 0.9).
  * Styled Start Pin in brand teal and Finish Pin in Craft Beer Amber Gold (`#DE9C1E`).
  * Updated elevation profile canvas chart with `#1A607C` stroke and linear gradient fill.
* **`src/components/RunCard.tsx`**:
  * Updated date blocks, RSVP badges, and check-in indicators to the `woodland` teal palette.
* **`src/components/Leaderboard.tsx`**:
  * Updated member spotlight header, badge unlocks, and active runner tags to the `woodland` palette.
* **`src/components/CheckInModal.tsx`**, **`AdminDashboard.tsx`**, **`InstallPwaBanner.tsx`**, **`GpxUploader.tsx`**:
  * Converted all buttons, alert boxes, and status pills to the new teal and amber design system.

---

*Woodland Woodchuckers Run Club • Established in Woodland, California • 100% Free Community Club*
