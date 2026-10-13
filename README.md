# 🚀 The Impostor (Pass & Play Party Game)

> **"One crewmate carries a secret. Can you spot the liar before time runs out?"**

A lightweight, responsive social deduction web game built with **Python (Flask)**, **Jinja2**, and **Vanilla HTML/CSS/JS**. Designed specifically for single-device mobile Pass & Play sessions.

---

## 🎮 How to Play

1. **Configure Game:** Choose 3–12 players, 1–3 impostors, debate time, rounds, and a category (or enter your own custom secret words).
2. **Setup Players:** Assign names or aliases to each crewmate.
3. **Pass & Play (Roles):** Pass the phone to each player with a privacy curtain. Crewmates discover the secret word; the Impostor is kept in the dark and must blend in.
4. **Orbital Debate:** The timer counts down continuously while players take turns speaking and questioning suspects.
5. **Vote & Verdict:** When time expires, players vote on who to eject. If the majority votes for the impostor, the crew wins! Otherwise, the impostor escapes.
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
