# Select — Acronym Sentence Game

Laravel 12 backend with real-time WebSockets and Vue 3 web frontend for the Select acronym game. Originally an IRC game from #select on EFnet, now reimagined for the web.

## Prerequisites

- Docker Engine with Compose plugin
- Node.js + Yarn (for frontend builds on host)
- Add to `/etc/hosts`: `127.0.0.1 select.test`

## Quick Start

```bash
# 1. Start Docker (first run auto-installs everything)
docker compose up -d

# 2. Build frontend assets (run on host, not in container)
yarn install
yarn build
```

Visit: http://select.test:8000

The first `docker compose up` automatically:
- Creates `.env` from `.env.example`
- Installs Composer dependencies
- Generates application key
- Runs database migrations
- Seeds the database (admin user + test user)
- Imports legacy gullkorn data from `sql/` dumps
- Sets storage permissions

## Docker Containers

| Container | Service | Purpose | Port |
|-----------|---------|---------|------|
| select-setup | setup | Setup (runs on every start, then exits) | - |
| select-app | select | PHP-FPM application | - |
| select-nginx | nginx | Web server (reverse proxy to PHP-FPM) | 8000 |
| select-db | db | PostgreSQL 16 database | 5432 |
| select-reverb | reverb | WebSocket server (Laravel Reverb) | 8080 |
| select-queue | queue | Background job worker | - |
| select-scheduler | scheduler | Task scheduler | - |
| select-delectus | delectus | Game orchestrator daemon | - |

**Default URLs:**
- Web: http://select.test:8000
- API: http://select.test:8000/api/v1
- WebSocket: ws://select.test:8080
- Debug Console: http://select.test:8000/debug

## Common Commands

### Docker

```bash
docker compose up -d              # Start all containers
docker compose down               # Stop all containers
docker compose up -d --build      # Rebuild and start
docker compose logs -f            # View all logs
docker compose logs -f select     # Logs for specific service
docker compose exec select bash   # Shell into app container
docker compose restart select     # Restart a service

# Reset everything (fresh start — destroys database!)
docker compose down -v --rmi local && rm -rf vendor .env
docker compose up -d
```

### Artisan Commands

All artisan commands must run **inside the container** (host may have a different PHP version):

```bash
docker compose exec select php artisan migrate
docker compose exec select php artisan db:seed
docker compose exec -it select php artisan tinker
docker compose exec select php artisan optimize:clear
docker compose exec select php artisan gullkorn:import
docker compose exec select php artisan list
```

Inside the container shell (`docker compose exec select bash`), the alias `a` is available:

```bash
a migrate          # php artisan migrate
a tinker           # php artisan tinker
a test --compact   # php artisan test --compact
```

### Frontend Build

Frontend assets (Vue 3 + PrimeVue + Tailwind) are built on the **host machine**:

```bash
yarn install    # Install dependencies
yarn build      # Production build → public/build/
yarn dev        # Development server with HMR
```

## Running Tests

```bash
# Run all tests
docker compose exec select php artisan test --compact

# Run a specific test file
docker compose exec select php artisan test --compact tests/Feature/Api/GameTest.php

# Run tests matching a name
docker compose exec select php artisan test --compact --filter=test_host_can_start_game

# Run only unit or feature tests
docker compose exec select php artisan test --compact tests/Unit/
docker compose exec select php artisan test --compact tests/Feature/
```

### Test Structure

```
tests/
├── Feature/
│   ├── Api/
│   │   ├── AdminTest.php              # Admin endpoints
│   │   ├── AnonymousVotingTest.php    # Vote anonymity
│   │   ├── ArchiveTest.php            # Game archive
│   │   ├── AuthGuestTest.php          # Guest auth
│   │   ├── AuthLoginTest.php          # Login flow
│   │   ├── AuthPasswordResetTest.php  # Password reset
│   │   ├── AuthRegistrationTest.php   # Registration
│   │   ├── AuthTest.php               # General auth
│   │   ├── BotFeatureTest.php         # Bot players
│   │   ├── ChatTest.php               # In-game chat
│   │   ├── CoHostTest.php             # Co-host management
│   │   ├── EndGameTest.php            # Game ending
│   │   ├── GameBanTest.php            # Player banning
│   │   ├── GameCreationTest.php       # Game creation
│   │   ├── GameInviteTest.php         # Player invitations
│   │   ├── GameTest.php               # Game CRUD, join/leave
│   │   ├── KickPlayerTest.php         # Player kicking
│   │   ├── MidGameJoinTest.php        # Join during play
│   │   ├── ProfileTest.php            # Profile management
│   │   ├── ProfileUpdateTest.php      # Profile updates
│   │   ├── RoundReadyTest.php         # Ready check feature
│   │   ├── RoundTest.php              # Answers, voting, rounds
│   │   └── TwoFactorTest.php         # 2FA auth
│   ├── Mail/
│   │   ├── PasswordResetMailTest.php  # Password reset email
│   │   └── WelcomeMailTest.php        # Welcome email
│   ├── Middleware/
│   │   └── BannedMiddlewareTest.php   # Ban enforcement
│   └── WelcomePageTest.php            # Welcome page
└── Unit/
    └── Domain/
        ├── AcronymGeneratorTest.php   # Acronym generation
        ├── AcronymValidatorTest.php   # Answer validation
        ├── BotAnswerServiceTest.php   # Bot answer logic
        ├── CreateBotPlayerActionTest.php # Bot creation
        └── EndGameActionTest.php      # Game ending logic
```

### Code Style

```bash
docker compose exec select vendor/bin/pint --dirty
```

## Configuration

### Changing Ports

Edit `.env` before starting:

```env
APP_PORT=8000              # Web server port
FORWARD_REVERB_PORT=8080   # WebSocket port
DB_EXTERNAL_PORT=5432      # PostgreSQL external port
```

### Production Deployment

| Setting | Development | Production |
|---------|-------------|------------|
| `APP_ENV` | local | production |
| `APP_DEBUG` | true | false |
| `APP_URL` | http://select.test:8000 | https://your-domain.com |
| `DB_EXTERNAL_PORT` | 5432 | 5433 (avoid host conflicts) |
| `FORWARD_REVERB_PORT` | 8080 | 8082 (avoid host conflicts) |
| `REVERB_SCHEME` | http | https |
| `LOG_LEVEL` | debug | warning |
| `MAIL_MAILER` | log | smtp |

**Production architecture:** Apache 2 (host) → reverse proxy → Docker nginx (port 8000) → PHP-FPM.

Apache handles SSL termination (Let's Encrypt) and proxies all traffic to the Docker container. WebSocket connections are proxied separately to the Reverb container.

### PHP Performance Tuning

The `docker/php/local.ini` includes OPcache production settings:

- `opcache.validate_timestamps = 0` — skips file stat checks (restart container after deploy)
- `opcache.jit = tracing` — enables PHP JIT compiler

The queue worker auto-restarts after 1000 jobs or 1 hour (`--max-jobs=1000 --max-time=3600`) to prevent memory leaks.

## Project Structure

```
app/
├── Console/Commands/     # Artisan commands (Delectus, Gullkorn import)
├── Domain/               # Business logic (DDD)
│   ├── Delectus/         # Game orchestrator daemon
│   ├── Game/             # Game management, scoring
│   ├── Player/           # Player auth, guest tokens, bots
│   └── Round/            # Acronyms, answers, votes
├── Application/          # HTTP layer
│   ├── Broadcasting/     # WebSocket events
│   ├── Http/Controllers/ # API controllers
│   └── Jobs/             # Queue jobs (bot answers/votes)
└── Infrastructure/       # Data layer
    └── Models/           # Eloquent models

resources/
├── js/
│   ├── app.js            # Vue 3 + PrimeVue entry
│   ├── composables/      # useI18n, useDarkMode, useGameAnimations, etc.
│   ├── layouts/          # AppLayout, GameLayout
│   ├── pages/            # Vue page components (Inertia.js)
│   ├── services/         # API client, WebSocket
│   └── stores/           # Pinia stores (auth, game, sound)
├── css/app.css           # Tailwind v4 + PrimeVue styles
└── views/                # Blade templates

database/
├── migrations/           # Database schema
├── factories/            # Model factories for tests
└── seeders/              # Admin user, test data

docker/
├── setup.sh              # Auto-setup script
├── nginx/default.conf    # Nginx configuration
└── php/local.ini         # PHP + OPcache settings

sql/                      # Legacy MySQL dumps (gullkorn)
```

## API Quick Reference

```bash
# Create guest player
curl -X POST http://select.test:8000/api/v1/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Player1"}'

# Create game (with guest token)
curl -X POST http://select.test:8000/api/v1/games \
  -H "Content-Type: application/json" \
  -H "X-Guest-Token: <token>" \
  -d '{"settings": {"rounds": 5}}'

# Join game
curl -X POST http://select.test:8000/api/v1/games/ABCDEF/join \
  -H "X-Guest-Token: <token>"
```

See [CLAUDE.md](CLAUDE.md) for full API documentation, WebSocket events, database schema, and game flow details.
