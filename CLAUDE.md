# SELECT

Multiplayer acronym word game. Players get a random acronym, write sentences matching the letters, then vote on favorites. Built with Laravel 12 + Vue 3 + Inertia + WebSockets.

## Tech Stack

- **Backend:** PHP 8.4, Laravel 12, Sanctum (auth), Reverb (WebSockets)
- **Frontend:** Vue 3 (Composition API), Inertia.js, PrimeVue, Pinia, Tailwind CSS 4
- **Build:** Vite, yarn (not npm)
- **Testing:** PHPUnit (backend), Vitest + happy-dom + @vue/test-utils (frontend)
- **Infra:** Docker (docker-compose)

## Architecture

Domain-Driven Design with three layers:

```text
app/
├── Domain/           # Pure business logic (actions, no framework deps)
│   ├── Delectus/     # Game orchestrator daemon (time-based transitions)
│   ├── Game/         # Game lifecycle, scoring
│   ├── Player/       # Auth, guest tokens, bots
│   └── Round/        # Acronyms, answers, votes
├── Application/      # HTTP controllers, broadcasting events, jobs
│   ├── Http/Controllers/Api/V1/
│   ├── Broadcasting/Events/
│   └── Jobs/
└── Infrastructure/   # Eloquent models
    └── Models/
```

Frontend:
```text
resources/js/
├── pages/            # Inertia page components
├── layouts/          # AppLayout.vue, GameLayout.vue
├── components/       # Shared components (PlayerAvatar)
├── stores/           # Pinia stores (gameStore, authStore, soundStore)
├── composables/      # useI18n, useDarkMode, useGameAnimations
└── services/         # API client (api.js)
```

## Key Patterns

- Game pages use `GameLayout.vue` with `layout: false` — they skip `AppLayout.vue`
- All game events broadcast on presence channel `game.{code}` via Laravel Reverb
- Broadcasting events extend `ShouldBroadcastNow` in `app/Application/Broadcasting/Events/`
- Controllers are thin: validate → call domain action → return response
- Delectus daemon ticks once/second for all time-based game transitions

## Commands

```bash
# Backend
docker exec select-app php artisan test --compact              # Run all PHP tests
docker exec select-app php artisan test --compact --filter=Name # Run specific test
docker exec select-app vendor/bin/pint --dirty                 # Code formatting

# Frontend
yarn build                    # Build frontend assets
yarn test                     # Run all frontend tests (vitest)
yarn test path/to/file        # Run specific test file
```

## Versioning

Version lives in `package.json` and is shown in the site footer. Bump before deploying:

```bash
yarn version:patch            # Bug fix:      1.0.0 → 1.0.1
yarn version:minor            # New feature:  1.0.0 → 1.1.0
yarn version:major            # Big change:   1.0.0 → 2.0.0
```

The git commit hash is appended automatically at build time (e.g. `v1.0.1-abc1234`).

## Conventions

- Follow existing code patterns — check sibling files before creating new ones
- Use Eloquent relationships, avoid `DB::` facade
- Use Form Request classes for validation (not inline)
- PHPUnit for all backend tests (convert any Pest tests to PHPUnit)
- Vue components use Composition API with `<script setup>`
- i18n via `useI18n()` composable — translations in Norwegian (default) and English
