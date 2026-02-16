# Select

A real-time multiplayer acronym sentence game. Players get a random acronym and race to create the funniest sentence where each word starts with the corresponding letter. Then everyone votes for their favorite.

Originally an IRC game from **#select** on EFnet, now reimagined for the web with Laravel 12, Vue 3, and WebSockets.

## Getting Started

You need [Docker](https://docs.docker.com/get-docker/) and [Node.js](https://nodejs.org/) with [Yarn](https://yarnpkg.com/) installed.

**1. Clone and configure**

```bash
git clone <repo-url> && cd select-laravel
cp .env.example .env
```

Open `.env` and set `APP_URL` to your preferred local domain:

```env
APP_URL=http://select.test:8000
```

**2. Add the domain to your hosts file**

```bash
# Linux / macOS
echo "127.0.0.1 select.test" | sudo tee -a /etc/hosts

# Windows (run as Administrator)
echo 127.0.0.1 select.test >> C:\Windows\System32\drivers\etc\hosts
```

**3. Start the application**

```bash
docker compose up -d --build
```

This builds and starts all containers. On first run, the setup container automatically installs dependencies, generates keys, runs migrations, seeds the database, and imports legacy data.

**4. Build the frontend**

```bash
yarn install
yarn build
```

**5. Open the app**

Visit [http://select.test:8000](http://select.test:8000) — the game is ready to play.

## Architecture

The entire application runs inside Docker. All backend services start with a single `docker compose up -d`.

| Container | Purpose | Port |
|-----------|---------|------|
| select | PHP-FPM application | - |
| nginx | Web server | 8000 |
| db | PostgreSQL 16 | 5432 |
| reverb | WebSocket server (Laravel Reverb) | 8080 |
| queue | Background job worker | - |
| scheduler | Task scheduler | - |
| delectus | Game orchestrator daemon | - |
| setup | First-run setup (exits after completion) | - |

Frontend assets are built on the host machine with Yarn and served by nginx from `public/build/`.

## Common Commands

### Docker

```bash
docker compose up -d              # Start all containers
docker compose down               # Stop all containers
docker compose logs -f select     # View application logs
docker compose exec select bash   # Shell into the app container
docker compose restart select     # Restart a service
```

### Artisan

All `php artisan` commands run inside the container:

```bash
docker compose exec select php artisan migrate
docker compose exec select php artisan db:seed
docker compose exec select php artisan test --compact
```

Inside the container shell, the alias `a` is available:

```bash
a migrate        # php artisan migrate
a test --compact  # php artisan test --compact
a tinker         # php artisan tinker
```

### Frontend

```bash
yarn dev          # Development server with hot reload
yarn build        # Production build
```

## Running Tests

```bash
# All tests
docker compose exec select php artisan test --compact

# Specific file
docker compose exec select php artisan test --compact tests/Feature/Api/GameTest.php

# Specific test
docker compose exec select php artisan test --compact --filter=test_host_can_start_game

# Code style
docker compose exec select vendor/bin/pint --dirty
```

## Configuration

Ports and other settings are configured through `.env`:

```env
APP_PORT=8000              # Web server
FORWARD_REVERB_PORT=8080   # WebSocket server
DB_EXTERNAL_PORT=5432      # PostgreSQL (host access)
```

To change ports, edit `.env` and restart: `docker compose down && docker compose up -d`.

## Tech Stack

- **Backend:** Laravel 12, PHP 8.4, PostgreSQL 16, Laravel Reverb
- **Frontend:** Vue 3, Inertia.js v2, PrimeVue v4, Tailwind CSS v4
- **Infrastructure:** Docker, nginx, OPcache with JIT

## Project Structure

```
app/
├── Domain/              # Business logic (DDD)
│   ├── Delectus/        # Game orchestrator daemon
│   ├── Game/            # Game management, scoring
│   ├── Player/          # Auth, guest tokens, bots
│   └── Round/           # Acronyms, answers, votes
├── Application/         # HTTP controllers, events, jobs
└── Infrastructure/      # Eloquent models

resources/js/
├── pages/               # Vue page components
├── composables/         # Shared logic (i18n, dark mode, animations)
├── stores/              # Pinia state management
└── services/            # API client, WebSocket

database/                # Migrations, factories, seeders
docker/                  # Docker config (nginx, PHP, setup script)
sql/                     # Legacy data imports
```

## Production Deployment

For production, use a reverse proxy (Apache or nginx) with SSL termination pointing to the Docker containers:

```
Client → Apache/nginx (SSL) → Docker nginx (:8000) → PHP-FPM
                             → Docker Reverb (:8080) for WebSockets
```

Key `.env` changes for production:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com
REVERB_SCHEME=https
LOG_LEVEL=warning
MAIL_MAILER=smtp
```

## License

All rights reserved.
