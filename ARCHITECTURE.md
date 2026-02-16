# Architecture

This document explains how Select is built, from the game loop to the infrastructure that supports it.

## How a Game Works

A game of Select follows a simple loop: create, play rounds, vote, score, repeat.

```
Create Game → Join Lobby → Start
                             ↓
                    ┌─── New Round ←──────────┐
                    ↓                         │
              Show Acronym                    │
              (e.g. "TIHWP")                  │
                    ↓                         │
           Players Write Sentences            │
           ("This Is How We Play")            │
                    ↓                         │
              Voting Phase                    │
           (authors are hidden)               │
                    ↓                         │
              Round Results                   │
           (authors revealed, scores updated) │
                    ↓                         │
              More rounds? ───── yes ─────────┘
                    │
                    no
                    ↓
              Game Finished
              (winner announced)
```

### Phase Details

**Lobby** — A player creates a game and receives a 6-character code (e.g. `CRF6BX`). Other players join using this code. The host starts when ready (minimum 2 players).

**Answering** — A random acronym is generated and displayed. Each player writes a sentence where every word starts with the corresponding letter. Players can mark themselves "ready" to skip the remaining timer. If all players are ready, voting starts immediately.

**Voting** — All submitted sentences are shown without author names to prevent bias. Players vote for their favorite (they cannot vote for their own). After the deadline, authors are revealed.

**Results** — Each answer is shown with its author and vote count. Points equal votes received. Scores update on the leaderboard. After a brief pause, the next round begins.

**Finished** — After all rounds complete, the player with the most total votes wins.

## Backend Architecture

The backend follows Domain-Driven Design with three layers:

```
app/
├── Domain/              ← Pure business logic, no framework dependencies
│   ├── Delectus/        ← Game orchestrator daemon
│   ├── Game/            ← Game lifecycle, scoring
│   ├── Player/          ← Authentication, guest tokens, bots
│   └── Round/           ← Acronyms, answers, votes
│
├── Application/         ← HTTP layer, framework glue
│   ├── Http/Controllers/Api/V1/
│   ├── Broadcasting/Events/
│   └── Jobs/
│
└── Infrastructure/      ← Database models (Eloquent)
    └── Models/
```

**Domain layer** contains all game logic as discrete actions: `CreateGameAction`, `SubmitAnswerAction`, `StartVotingAction`, etc. These are plain PHP classes with no database knowledge — they receive models and return results.

**Application layer** handles HTTP requests, dispatches broadcast events, and queues background jobs. Controllers are thin: validate input, call a domain action, return a response.

**Infrastructure layer** maps database tables to Eloquent models.

### Delectus — The Game Orchestrator

Named after the original IRC bot from #select on EFnet, Delectus is a daemon that runs continuously in its own container. It ticks once per second and handles all time-based transitions:

- Answer deadline passed → start voting (or extend if no answers yet)
- Voting deadline passed → complete round, calculate scores
- Round completed → start next round (after configurable pause)
- All rounds done → end game
- Lobby idle for 5 minutes → warn players, then close

Delectus acts as a safety net. If a host disconnects or a WebSocket event is missed, the game still progresses on schedule. It also handles edge cases: if nobody submits an answer, it extends the deadline twice before ending the game. If only one answer is submitted, it skips voting entirely.

Bot players are also coordinated through Delectus — when a round starts, it dispatches delayed jobs (`BotSubmitAnswerJob`, `BotSubmitVoteJob`) with randomized timing so bots feel natural.

### Acronym Generation

The `AcronymGenerator` creates 3–6 letter acronyms using weighted letter selection. Common consonants (S, T, N, R) appear frequently while rare letters (Q, X, Z) are uncommon. The algorithm enforces at least one vowel in longer acronyms and prevents more than three consecutive consonants, ensuring every acronym is playable.

The `AcronymValidator` checks submitted sentences by comparing the first letter of each word against the acronym. It enforces exact word count (one word per letter) and only allows letters and basic punctuation.

### Scoring

Scoring is straightforward: each vote on your answer equals one point. The `ScoringService` tallies votes per answer, increments each player's cumulative score in `game_players`, and sorts the final standings by total score. In case of a tie at the top, no single winner is declared.

After a game ends, `updatePlayerStats` records lifetime statistics (games played, games won, total score) on each player's record.

## Real-Time Communication

All real-time features use WebSockets via Laravel Reverb, with Laravel Echo on the client.

### Channel Design

Each game has a single presence channel: `presence-game.{code}`. This provides:
- **Membership awareness** — know who's connected (`.here`, `.joining`, `.leaving`)
- **Event broadcasting** — server pushes state changes to all connected players

### Event Flow

| Event | Direction | When | Payload |
|-------|-----------|------|---------|
| `player.joined` | Server → All | Player enters lobby | `{ player }` |
| `player.left` | Server → All | Player leaves | `{ player_id, new_host_id }` |
| `player.kicked` | Server → All | Player removed by host | `{ player_id, banned }` |
| `game.started` | Server → All | Host starts the game | `{ round }` |
| `round.started` | Server → All | New round begins | `{ acronym, answer_deadline, round_number }` |
| `answer.submitted` | Server → All | Someone submits an answer | `{ answers_count, total_players }` |
| `player.ready` | Server → All | Player marks ready | `{ ready_count, total_players }` |
| `voting.started` | Server → All | Answer phase ends | `{ answers[], vote_deadline }` |
| `vote.submitted` | Server → All | Someone votes | `{ votes_count, total_voters }` |
| `round.completed` | Server → All | Round scored | `{ results[], scores[] }` |
| `game.finished` | Server → All | All rounds done | `{ winner, final_scores[] }` |
| `game.settings_changed` | Server → All | Host changes settings | `{ settings, is_public }` |
| `lobby.expiring` | Server → All | Lobby idle 5 min | `{ seconds_remaining }` |
| `chat.message` | Server → All | Chat or system message | `{ player, message, system }` |

### Anonymous Voting

During the voting phase, the `voting.started` event delivers answers **without** `player_id` or `player_name`. Only after `round.completed` are authors revealed. This prevents voter bias.

### Broadcast Authentication

WebSocket presence channels require authorization. A custom endpoint `POST /api/broadcasting/auth` handles both auth methods:
- **Guest players**: validated via `X-Guest-Token` header
- **Registered users**: validated via `Authorization: Bearer` token (Sanctum)

The endpoint generates a Pusher-compatible signature that Reverb uses to authorize the channel subscription.

## API Reference

All endpoints are prefixed with `/api/v1`. Authentication is via `X-Guest-Token` header (guests) or `Authorization: Bearer` token (registered users).

### Authentication

```
POST   /auth/guest              Create guest player (returns token)
POST   /auth/register           Create account (email + password)
POST   /auth/login              Login (returns Sanctum token)
POST   /auth/logout             Logout (revoke token)
POST   /auth/convert            Convert guest to registered account
GET    /auth/me                 Current player profile
POST   /auth/forgot-password    Send password reset email
POST   /auth/reset-password     Reset password with token
```

### Games

```
GET    /games                   List public games
POST   /games                   Create game
GET    /games/{code}            Game details
GET    /games/{code}/state      Full state (for reconnect/refresh)
POST   /games/{code}/join       Join by code
POST   /games/{code}/leave      Leave game
POST   /games/{code}/start      Start game (host only)
POST   /games/{code}/end        End game early (host only)
POST   /games/{code}/keepalive  Keep lobby alive
POST   /games/{code}/chat       Send chat message
POST   /games/{code}/rematch    Create rematch game
POST   /games/{code}/invite     Generate invite link
PATCH  /games/{code}/settings   Update game settings (host)
PATCH  /games/{code}/visibility Toggle public/private (host)
```

### Player Management

```
POST   /games/{code}/co-host/{id}   Toggle co-host status
POST   /games/{code}/add-bot        Add bot player (admin)
DELETE /games/{code}/bot/{id}        Remove bot
POST   /games/{code}/kick/{id}      Kick player (host/co-host)
POST   /games/{code}/ban/{id}       Ban player
POST   /games/{code}/unban/{id}     Unban player
```

### Rounds

```
GET    /games/{code}/rounds/current  Current round details
POST   /rounds/{id}/answer          Submit answer
POST   /rounds/{id}/vote            Vote for an answer
DELETE /rounds/{id}/vote             Retract vote
POST   /rounds/{id}/ready           Mark as ready (skip timer)
POST   /rounds/{id}/voting          Start voting early (host)
POST   /rounds/{id}/complete        Complete round early (host)
```

### Public (No Auth Required)

```
GET    /stats                             Global statistics
GET    /archive                           Finished games list
GET    /archive/{code}                    Game archive details
GET    /archive/{code}/rounds/{number}    Round archive details
GET    /leaderboard                       Top players
GET    /hall-of-fame                      Best sentences
GET    /hall-of-fame/random               Random featured sentence
GET    /players/{nickname}                Player profile
GET    /players/{nickname}/stats          Player statistics
GET    /players/{nickname}/sentences      Player's best sentences
GET    /players/{nickname}/games          Player's game history
```

### Admin

```
GET    /admin/players            All players (admin only)
GET    /admin/games              All games (admin only)
GET    /admin/stats              System statistics
POST   /admin/ban                Global ban
POST   /admin/unban/{id}         Remove global ban
```

### Profile Management

```
PATCH  /profile/                 Update profile
PATCH  /profile/password         Change password
PATCH  /profile/nickname         Change nickname
DELETE /profile/                 Delete account
```

### Two-Factor Authentication

```
POST   /two-factor/enable       Generate 2FA secret + QR
POST   /two-factor/confirm      Confirm 2FA setup with code
DELETE /two-factor/disable       Disable 2FA
```

## Frontend Architecture

The frontend is a Vue 3 single-page application rendered via Inertia.js v2 (server-side routing, client-side rendering).

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API) |
| Routing | Inertia.js v2 |
| UI Components | PrimeVue v4 (Aura theme) |
| Styling | Tailwind CSS v4 |
| State | Pinia |
| WebSocket | Laravel Echo + Pusher.js → Reverb |
| Build | Vite |
| Animations | GSAP |
| Sound | Howler.js |

### Page Structure

Pages live in `resources/js/pages/` and are routed by Laravel via Inertia. Game-related pages (`Game.vue`, `GameSpectate.vue`, `Welcome.vue`) use no layout wrapper for a full-screen experience.

### Game Store

The `gameStore` (Pinia) is the central hub for all game state. It manages:

- **Game data**: current game, players, phase, scores
- **Round state**: acronym, answers, votes, deadline timers
- **WebSocket connection**: subscribes to `presence-game.{code}`, processes all events
- **Countdown timers**: deadline-based for active phases, simple decrement for between-round pauses
- **Reconnection**: `fetchGameState()` recovers full state from the server on page refresh

The store listens to 13 WebSocket events and updates local state accordingly. When a deadline expires without a WebSocket event (network issues), it polls the server after a 3-second grace period.

### Services

**API service** (`services/api.js`) — Axios-based HTTP client. Automatically attaches `X-Guest-Token` or `Bearer` token. Provides a clean interface: `api.games.create()`, `api.rounds.submitAnswer()`, etc.

**WebSocket service** (`services/websocket.js`) — Initializes Laravel Echo with Reverb, reads config from meta tags. Handles authorization by attaching both auth tokens to the broadcast auth request. Exports `joinGame(code)` and `leaveGame(code)`.

### Composables

- `useI18n` — Norwegian/English translation with localStorage persistence
- `useDarkMode` — Class-based dark mode, respects system preference
- `useGameAnimations` — GSAP animations for phase transitions and element staggers

## Authentication

Select uses a guest-first approach: anyone can play immediately without creating an account.

### Guest Flow

1. Player enters a nickname → `POST /auth/guest`
2. Server creates a `Player` record with a unique `guest_token`
3. Token stored in `localStorage` as `select-guest-token`
4. All requests include `X-Guest-Token` header

### Registered User Flow

1. Player registers or logs in → receives a Sanctum bearer token
2. Token stored in `localStorage` as `select-auth-token`
3. All requests include `Authorization: Bearer` header
4. Guest token is removed from `localStorage` on login

### Guest-to-User Conversion

Guests can convert to a full account at any time via `POST /auth/convert`. The existing player record is linked to the new user account, preserving all stats and game history.

## Database Schema

### Core Tables

**players** — All players (guests and registered). UUID primary key, optional `user_id` link, `guest_token` for guests, `is_bot` flag for automated players. Tracks lifetime stats.

**games** — Each game has a unique 6-character `code`, a `host_player_id`, `status` (lobby/playing/voting/finished), and a JSON `settings` column with all configurable options.

**game_players** — Join table linking players to games. Tracks `score`, `is_active`, `is_co_host`, join/leave timestamps.

**rounds** — Each round belongs to a game. Stores the `acronym`, `status` (answering/voting/completed), and `answer_deadline`/`vote_deadline` timestamps.

**answers** — Player submissions. Links to round and player, stores the sentence `text`, `votes_count`, `is_ready` flag, and `edit_count`.

**votes** — Links an answer to a voter. Tracks `change_count` if vote changes are allowed.

### Supplementary Tables

**game_results** — Denormalized snapshot of final standings, created when a game ends.

**hall_of_fame** — Archive of winning sentences for the public hall of fame.

**gullkorn / gullkorn_clean** — Legacy sentences from the original IRC #select game (imported from MySQL dumps in `sql/`). Used by the bot answer service to find matching sentences.

### Game Settings

```json
{
  "rounds": 5,
  "answer_time": 120,
  "vote_time": 30,
  "time_between_rounds": 15,
  "min_players": 2,
  "max_players": 8,
  "acronym_length_min": 3,
  "acronym_length_max": 6,
  "max_edits": 0,
  "max_vote_changes": 0,
  "allow_ready_check": true,
  "chat_enabled": true
}
```

## Bot Players

Admins can add bot players to fill games. Bots have Norwegian names with a 2-digit suffix (e.g. "Kansen 47") and the `is_bot` flag set.

**Answer generation**: `BotAnswerService` first searches `gullkorn_clean` for a sentence from the original IRC game that matches the current acronym. If none found, it falls back to a word bank.

**Timing**: Bot actions are dispatched as delayed queue jobs with randomized delays (answers: 20–80% of answer time, votes: 15–70% of vote time) so they feel natural rather than instant.

## Infrastructure

### Docker Containers

| Container | Service | Purpose |
|-----------|---------|---------|
| select | PHP 8.4 FPM | Application server |
| nginx | nginx | Web server, reverse proxy to PHP-FPM |
| db | PostgreSQL 16 | Database |
| reverb | Laravel Reverb | WebSocket server |
| queue | Queue worker | Background jobs (bot actions, etc.) |
| scheduler | Scheduler | Cron-like task scheduling |
| delectus | Delectus daemon | Game orchestrator |
| setup | Setup script | First-run initialization |

### Production Architecture

```
Internet → Apache/nginx (SSL termination)
              ├──→ Docker nginx (:8000) → PHP-FPM
              └──→ Docker Reverb (:8080) for WebSocket
```

The host web server handles SSL (Let's Encrypt) and reverse-proxies to the Docker containers. The application itself is unaware of HTTPS — it uses `URL::forceScheme('https')` and `trustProxies(at: '*')` to generate correct URLs.

### Performance

- **OPcache** with JIT tracing enabled, timestamp validation disabled (restart container to pick up code changes)
- **Queue worker** auto-restarts after 1000 jobs or 1 hour to prevent memory leaks
- **Delectus** runs as a lightweight daemon with 1-second tick intervals
