# Quest For Skateboarding (QFS)

Quest For Skateboarding (QFS) is a play-to-earn web game built around the Hive blockchain. Players compete for high scores and best times, with weekly rewards distributed based on performance. The project consists of a Node.js backend, a web frontend, and a full HTML5 game embedded in the site.

---

## Features
- **Play-to-Earn Game:** Compete for high scores and best times in a browser-based skateboarding game.
- **Blockchain Integration:** Uses the Hive blockchain for authentication, score publishing, and reward distribution.
- **Weekly Rewards:** Players earn HBD and GNAR tokens based on leaderboard performance and community upvotes.
- **Leaderboard System:** Live leaderboards for high scores and best times.
- **Firebase Integration:** Stores user data, scores, and reward info in Firebase Realtime Database.

---

## Project Structure

```
QFS-server/
├── index.js                # Main Node.js/Express server
├── worker.js               # Background worker for rewards and blockchain tasks
├── hivesql/
│   └── main.js             # SQL endpoint for Hive SQL queries
├── website/
│   ├── main.html           # Main landing page
│   ├── main.js             # Frontend logic (login, leaderboard, voting)
│   ├── QFS/
│   │   ├── index.html      # Game embed page
│   │   └── html5game/
│   │       └── QFShive.js  # Main HTML5 game file (large, compiled)
│   ├── images/, fonts/, sounds/  # Game and site assets
│   └── style.css           # Site styling
├── package.json            # Project metadata and dependencies
├── post.md                 # Weekly post template/documentation
├── Dockerfile, Procfile    # Deployment configs
└── ...
```

---

## Getting Started

### Prerequisites
- Node.js
- Hive Keychain browser extension (for users)
- Firebase project (for backend)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (see `.env.example` or documentation).
4. Start the server:
   ```
   npm start
   ```
5. Visit the site at `http://localhost:PORT` (default port as configured).

---

## Scripts
- `npm start` — Starts the main server.
- `npm run live` — Starts the server with nodemon for development.

---

## Authors & Credits
- Developed by @web-gnar, @gnarip12345 & @ali-h
- Brought to you by [Skatehive](https://skatehive.app) and [Gnars DAO](https://www.gnars.wtf/)

---

## Additional Notes
- The game is play-to-earn, with blockchain-based rewards.
- Weekly posts and upvotes on Hive increase the reward pool.
- All major logic for authentication, score handling, and rewards is handled server-side, with the frontend focused on user experience and game embedding.

--- 