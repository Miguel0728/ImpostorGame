# 🔦 Sospecha (Pass & Play Party Game)

> **"One player doesn't know the secret word and is pretending. Can you spot the liar before time runs out?"**

A lightweight, responsive social deduction web game built with **Python (Flask)**, **Jinja2**, and **Vanilla HTML/CSS/JS**. Designed specifically for single-device mobile Pass & Play sessions. The interface is in Spanish.

---

## 🎮 How to Play

1. **Configure Game:** Choose 3–12 players, 1–3 impostors, debate time, rounds, and a category (or enter your own custom secret words).
2. **Setup Players:** Assign names or aliases to each player.
3. **Pass & Play (Roles):** Pass the phone to each player with a privacy curtain. Players discover the secret word; the Impostor is kept in the dark and must blend in.
4. **Debate:** The timer counts down continuously while players take turns speaking and questioning suspects.
5. **Vote & Verdict:** When time expires, players vote on who they suspect. If the majority votes for the impostor, the players win! Otherwise, the impostor escapes.
6. **Multi-round Support:** Automatically advance to the next round with fresh secret words and newly shuffled roles.

### 🌐 Online Room Mode

From the home screen, **CREAR SALA ONLINE** sets up the rules and opens a lobby with a 4-letter code. The host shares the room link; every player opens it on their own phone, picks a name and sees only their own role. The host (who also plays) starts the game, closes the debate and advances rounds; votes are cast from each phone and the verdict appears for everyone at once.

> Rooms are kept in memory, so the server must run with a **single worker** (`gunicorn run:app` does by default). Rooms expire after 6 hours of inactivity and are lost if the server restarts.

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Python 3, Flask (Application Factory & Blueprints).
- **Frontend:** Jinja2 templates, semantic HTML5, Vanilla CSS (Glassmorphism & Neon theme), modern Vanilla JS.
- **Separation of Concerns:**
  - `app/routes/`: Route controllers and template rendering.
  - `app/services/`: Game state management and business logic.
  - `app/templates/`: Modularized Jinja2 templates organized by lifecycle (`layout/`, `home/`, `setup/`, `game/`, `voting/`).
  - `app/static/`: Dedicated CSS and JS assets without inline scripts or styles.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Miguel0728/ImpostorGame.git
cd ImpostorGame
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the development server
```bash
python run.py
```

### 4. Open in your browser
Navigate to `http://localhost:5000` (or your local network IP on mobile).

### 5. Run the tests
```bash
node --test tests/modo-local.test.js tests/service-worker.test.js
```

### 6. Install it as an app (PWA)
The app ships a web manifest (`/manifest.webmanifest`), a service worker (`/service-worker.js`) and an `/offline` page. In Chrome open DevTools → *Application* to check *Manifest* and *Service Workers*, then switch *Network* to *Offline* and reload: Pass & Play keeps working, online rooms show `/offline`. The cache version is computed from the files themselves, so it refreshes automatically when anything changes. Installing on a phone needs HTTPS (or `localhost`).

Pass & Play runs entirely in the browser (`app/static/js/modo-local.js`, state in `localStorage`) and shares the word list in `app/database/words.json` with the online mode.

---

## 🌍 Production

Rooms live in memory, so run **a single worker**:

```bash
gunicorn run:app --workers 1 --threads 4
```

Environment variables:

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | **Required.** The server refuses to start without it. Generate one with `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `TRUST_PROXY` | Number of proxies in front of the app (usually `1` on a hosting platform), so rate limiting sees the visitor's real IP. |
| `CONTACT_EMAIL` | Public contact shown in the privacy policy (`/privacidad`), which Google Play asks for. |
| `ANDROID_PACKAGE_NAME` | Android package id from PWABuilder (e.g. `com.yourname.sospecha`). Needed by `/.well-known/assetlinks.json`; the route answers 404 until it is set. |
| `ANDROID_SHA256_FINGERPRINTS` | SHA-256 fingerprint(s) of the signing certificate, comma-separated (with Play App Signing, the one shown in Play Console's app integrity page). |

Limits: at most 500 open rooms and 5 new rooms per hour per IP. The hosting health check is `GET /healthz`.
