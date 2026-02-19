<?php

namespace App\Application\Http\Controllers\Api\V1;

use App\Application\Broadcasting\Events\ChatMessageBroadcast;
use App\Application\Broadcasting\Events\CoHostChangedBroadcast;
use App\Application\Broadcasting\Events\GameFinishedBroadcast;
use App\Application\Broadcasting\Events\GameRematchBroadcast;
use App\Application\Broadcasting\Events\GameSettingsChangedBroadcast;
use App\Application\Broadcasting\Events\GameStartedBroadcast;
use App\Application\Broadcasting\Events\PlayerJoinedBroadcast;
use App\Application\Broadcasting\Events\PlayerKickedBroadcast;
use App\Application\Broadcasting\Events\PlayerLeftBroadcast;
use App\Application\Broadcasting\Events\RoundStartedBroadcast;
use App\Application\Http\Requests\Api\V1\CreateGameRequest;
use App\Application\Http\Requests\Api\V1\InvitePlayerRequest;
use App\Application\Http\Requests\Api\V1\JoinGameRequest;
use App\Application\Jobs\BotSubmitAnswerJob;
use App\Application\Mail\GameInviteMail;
use App\Domain\Game\Actions\CreateGameAction;
use App\Domain\Game\Actions\EndGameAction;
use App\Domain\Game\Actions\GetGameByCodeAction;
use App\Domain\Game\Actions\JoinGameAction;
use App\Domain\Game\Actions\KickPlayerAction;
use App\Domain\Game\Actions\LeaveGameAction;
use App\Domain\Game\Actions\StartGameAction;
use App\Domain\Player\Actions\CreateBotPlayerAction;
use App\Http\Controllers\Controller;
use App\Infrastructure\Models\Game;
use App\Infrastructure\Models\Player;
use App\Infrastructure\Models\Round;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class GameController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $player = $request->attributes->get('player');

        $formatGame = fn ($game) => [
            'code' => $game->code,
            'host_nickname' => $game->host?->nickname,
            'host_avatar_url' => $game->host?->user?->gravatarUrl(48),
            'player_count' => $game->player_count,
            'max_players' => $game->settings['max_players'] ?? 8,
            'rounds' => $game->settings['rounds'] ?? 8,
            'is_public' => $game->is_public,
            'has_password' => ! is_null($game->password),
            'status' => $game->status,
            'current_round' => $game->current_round,
            'total_rounds' => $game->total_rounds,
        ];

        $games = Game::publicJoinable()
            ->withCount(['gamePlayers as player_count' => function ($q) {
                $q->where('is_active', true);
            }])
            ->with('host.user')
            ->latest()
            ->limit(20)
            ->get()
            ->filter(fn ($game) => $game->player_count > 0)
            ->values()
            ->map($formatGame);

        // Include the player's own active games (even private ones)
        $myGames = collect();
        if ($player) {
            $myGames = Game::whereIn('status', [Game::STATUS_LOBBY, Game::STATUS_PLAYING, Game::STATUS_VOTING])
                ->whereHas('gamePlayers', fn ($q) => $q->where('player_id', $player->id)->where('is_active', true))
                ->withCount(['gamePlayers as player_count' => fn ($q) => $q->where('is_active', true)])
                ->with('host.user')
                ->where('updated_at', '>=', now()->subHours(2))
                ->latest()
                ->limit(10)
                ->get()
                ->map($formatGame);
        }

        return response()->json([
            'games' => $games,
            'my_games' => $myGames,
        ]);
    }

    public function store(CreateGameRequest $request, CreateGameAction $action): JsonResponse
    {
        $player = $request->attributes->get('player');

        $game = $action->execute(
            $player,
            $request->validated('settings', []),
            (bool) $request->validated('is_public', false),
            $request->validated('password'),
        );

        return response()->json([
            'game' => $this->formatGame($game),
        ], 201);
    }

    public function show(string $code, GetGameByCodeAction $action): JsonResponse
    {
        $game = $action->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        return response()->json([
            'game' => $this->formatGame($game),
        ]);
    }

    public function join(JoinGameRequest $request, string $code, GetGameByCodeAction $getGame, JoinGameAction $action): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        try {
            $action->execute($game, $player, $request->validated('password'));
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        // Touch game so lobby inactivity timer resets
        $game->touch();

        try {
            broadcast(new PlayerJoinedBroadcast($game, $player))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: player.joined', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'game' => $this->formatGame($game->fresh()),
        ]);
    }

    public function leave(Request $request, string $code, GetGameByCodeAction $getGame, LeaveGameAction $action): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        try {
            $action->execute($game, $player);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $game->touch();

        try {
            broadcast(new PlayerLeftBroadcast($game, $player))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: player.left', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
        ]);
    }

    public function start(Request $request, string $code, GetGameByCodeAction $getGame, StartGameAction $action): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        try {
            $game = $action->execute($game, $player);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $round = $game->currentRoundModel();

        try {
            broadcast(new GameStartedBroadcast($game))->toOthers();
            broadcast(new RoundStartedBroadcast($game, $round))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: game.started', ['game' => $code, 'error' => $e->getMessage()]);
        }

        // Dispatch bot answer jobs for round 1
        $botPlayers = $game->activePlayers()->where('players.is_bot', true)->get();
        $answerTime = $game->settings['answer_time'] ?? 60;
        $maxDelay = min(max(8, (int) ($answerTime * 0.8)), max(1, $answerTime - 1));
        $minDelay = min(max(3, (int) ($answerTime * 0.2)), $maxDelay);
        foreach ($botPlayers as $bot) {
            $delay = random_int($minDelay, $maxDelay);
            BotSubmitAnswerJob::dispatch($round->id, $bot->id)->delay(now()->addSeconds($delay));
        }

        return response()->json([
            'game' => $this->formatGame($game),
            'round' => [
                'id' => $round->id,
                'round_number' => $round->round_number,
                'acronym' => $round->acronym,
                'status' => $round->status,
                'answer_deadline' => $round->answer_deadline?->toIso8601String(),
            ],
        ]);
    }

    public function end(Request $request, string $code, GetGameByCodeAction $getGame, EndGameAction $endAction): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if ($game->isFinished()) {
            return response()->json(['error' => 'Spillet er allerede avsluttet.'], 422);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan avslutte spillet.'], 403);
        }

        if ($game->isInLobby()) {
            // Lobby games: just cancel, no scoring needed
            $game->update([
                'status' => Game::STATUS_FINISHED,
                'finished_at' => now(),
                'settings' => array_merge($game->settings, ['finished_reason' => 'cancelled']),
            ]);

            try {
                broadcast(new GameFinishedBroadcast($game, []));
            } catch (\Throwable $e) {
                Log::error('Broadcast failed: game.finished', ['game' => $code, 'error' => $e->getMessage()]);
            }
        } else {
            // Active games: use full EndGameAction with scoring
            $endAction->execute($game, 'ended_by_host');
        }

        return response()->json(['success' => true]);
    }

    public function state(Request $request, string $code, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        $round = $game->currentRoundModel();
        $response = [
            'game' => $this->formatGame($game),
            'phase' => $this->derivePhase($game, $round),
        ];

        // Include current round info if game is active
        if ($round) {
            $response['round'] = [
                'id' => $round->id,
                'round_number' => $round->round_number,
                'acronym' => $round->acronym,
                'status' => $round->status,
                'answer_deadline' => $round->answer_deadline?->toIso8601String(),
                'vote_deadline' => $round->vote_deadline?->toIso8601String(),
            ];

            // Check if current player has submitted an answer
            $myAnswer = $round->answers()->where('player_id', $player->id)->first();
            if ($myAnswer) {
                $response['my_answer'] = [
                    'id' => $myAnswer->id,
                    'text' => $myAnswer->text,
                    'is_ready' => $myAnswer->is_ready,
                    'edit_count' => $myAnswer->edit_count,
                ];
            }

            // Include ready count during answering phase
            if ($round->isAnswering() && ($game->settings['allow_ready_check'] ?? true)) {
                $response['round']['ready_count'] = $round->answers()->where('is_ready', true)->count();
                $response['round']['total_players'] = $game->activePlayers()->count();
            }

            // Include answers if voting or completed
            if ($round->isVoting() || $round->isCompleted()) {
                $isCompleted = $round->isCompleted();
                $query = $round->answers()->with('player');
                if ($isCompleted) {
                    $query->withCount('votes');
                }
                $allAnswers = $query->get();

                // Shuffle during voting for anonymous presentation (seeded for stable order)
                if (! $isCompleted) {
                    $allAnswers = $allAnswers->shuffle(crc32($round->id));
                }

                $response['answers'] = $allAnswers->map(fn ($a) => array_merge([
                    'id' => $a->id,
                    'text' => $a->text,
                    'votes_count' => $isCompleted ? $a->votes_count : null,
                ], $isCompleted ? [
                    'player_id' => $a->player_id,
                    'player_name' => $a->author_nickname ?? $a->player->nickname,
                ] : []))->values();

                // Check if current player has voted
                $myVoteRecord = \App\Infrastructure\Models\Vote::whereIn('answer_id', $round->answers->pluck('id'))
                    ->where('voter_id', $player->id)
                    ->first();
                if ($myVoteRecord) {
                    $response['my_vote'] = [
                        'answer_id' => $myVoteRecord->answer_id,
                        'change_count' => $myVoteRecord->change_count,
                    ];
                }
            }
        }

        // Include completed rounds results
        $completedRounds = $game->rounds()
            ->where('status', 'completed')
            ->with(['answers' => fn ($q) => $q->withCount('votes')->with('player')])
            ->orderBy('round_number')
            ->get()
            ->map(fn ($r) => [
                'round_number' => $r->round_number,
                'acronym' => $r->acronym,
                'answers' => $r->answers->sortByDesc('votes_count')->values()->map(fn ($a) => [
                    'player_name' => $a->author_nickname ?? $a->player->nickname,
                    'text' => $a->text,
                    'votes_count' => $a->votes_count,
                ]),
            ]);

        if ($completedRounds->isNotEmpty()) {
            $response['completed_rounds'] = $completedRounds;
        }

        return response()->json($response);
    }

    public function chat(Request $request, string $code, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! ($game->settings['chat_enabled'] ?? true)) {
            return response()->json(['error' => 'Chat er deaktivert for dette spillet.'], 403);
        }

        // Rate limit: 1 message per 2 seconds per player
        $rateLimitKey = 'chat:'.$player->id.':'.$code;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            return response()->json(['error' => 'For mange meldinger. Vent litt.'], 429);
        }
        RateLimiter::hit($rateLimitKey, 2);

        $request->validate([
            'message' => 'required|string|max:200',
            'action' => 'sometimes|boolean',
        ]);

        $message = $request->input('message');
        $isAction = $request->boolean('action');

        // Touch game so lobby inactivity timer resets on chat activity
        if ($game->isInLobby()) {
            $game->touch();
        }

        try {
            broadcast(new ChatMessageBroadcast($game, $player->nickname, $message, false, $isAction))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: chat.message', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'sent' => true,
            'message' => [
                'nickname' => $player->nickname,
                'message' => $message,
                'action' => $isAction,
            ],
        ]);
    }

    public function toggleCoHost(Request $request, string $code, string $playerId, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if ($game->host_player_id !== $player->id) {
            return response()->json(['error' => 'Bare verten kan administrere medverter.'], 403);
        }

        if ($playerId === $player->id) {
            return response()->json(['error' => 'Du kan ikke endre din egen medvertstatus.'], 422);
        }

        $gamePlayer = $game->gamePlayers()
            ->where('player_id', $playerId)
            ->where('is_active', true)
            ->first();

        if (! $gamePlayer) {
            return response()->json(['error' => 'Spilleren ble ikke funnet i dette spillet.'], 404);
        }

        $gamePlayer->update(['is_co_host' => ! $gamePlayer->is_co_host]);
        $game->touch();

        try {
            broadcast(new CoHostChangedBroadcast($game, $playerId, $gamePlayer->is_co_host));
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: co_host.changed', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'player_id' => $playerId,
            'is_co_host' => $gamePlayer->is_co_host,
        ]);
    }

    public function kick(Request $request, string $code, string $playerId, GetGameByCodeAction $getGame, KickPlayerAction $action): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        try {
            $action->execute($game, $player, $playerId);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $game->touch();
        $kickedPlayer = \App\Infrastructure\Models\Player::find($playerId);

        if ($kickedPlayer) {
            try {
                broadcast(new PlayerKickedBroadcast($game, $kickedPlayer, $player->nickname));
                broadcast(new ChatMessageBroadcast($game, 'Delectus', "{$kickedPlayer->nickname} ble sparket fra spillet av {$player->nickname}", true));
            } catch (\Throwable $e) {
                Log::error('Broadcast failed: player.kicked', ['game' => $code, 'error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'success' => true,
            'player_id' => $playerId,
        ]);
    }

    public function banPlayer(Request $request, string $code, string $playerId, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if ($game->isFinished()) {
            return response()->json(['error' => 'Kan ikke utestenge spillere fra et avsluttet spill.'], 422);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan utestenge spillere.'], 403);
        }

        if ($playerId === $game->host_player_id) {
            return response()->json(['error' => 'Kan ikke utestenge verten.'], 422);
        }

        $request->validate([
            'reason' => 'nullable|string|max:200',
        ]);

        $gamePlayer = $game->gamePlayers()
            ->where('player_id', $playerId)
            ->first();

        if (! $gamePlayer) {
            return response()->json(['error' => 'Spilleren ble ikke funnet i dette spillet.'], 404);
        }

        // Co-hosts cannot ban other co-hosts — only the host can
        if ($player->id !== $game->host_player_id && $gamePlayer->is_co_host) {
            return response()->json(['error' => 'Bare verten kan utestenge medverter.'], 403);
        }

        $gamePlayer->update([
            'is_active' => false,
            'is_co_host' => false,
            'kicked_by' => $player->id,
            'banned_by' => $player->id,
            'ban_reason' => $request->input('reason'),
        ]);
        $game->touch();

        $bannedPlayer = Player::find($playerId);

        if ($bannedPlayer) {
            try {
                broadcast(new PlayerKickedBroadcast($game, $bannedPlayer, $player->nickname, true, $request->input('reason')));
                broadcast(new ChatMessageBroadcast($game, 'Delectus', "{$bannedPlayer->nickname} ble utestengt fra spillet av {$player->nickname}", true));
            } catch (\Throwable $e) {
                Log::error('Broadcast failed: player.banned', ['game' => $code, 'error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'success' => true,
            'player_id' => $playerId,
        ]);
    }

    public function unbanPlayer(Request $request, string $code, string $playerId, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan oppheve utestengelse.'], 403);
        }

        $gamePlayer = $game->gamePlayers()
            ->where('player_id', $playerId)
            ->whereNotNull('banned_by')
            ->first();

        if (! $gamePlayer) {
            return response()->json(['error' => 'Utestengt spiller ble ikke funnet.'], 404);
        }

        $gamePlayer->update([
            'banned_by' => null,
            'ban_reason' => null,
            'kicked_by' => null,
        ]);
        $game->touch();

        return response()->json([
            'success' => true,
            'player_id' => $playerId,
        ]);
    }

    public function addBot(Request $request, string $code, GetGameByCodeAction $getGame, CreateBotPlayerAction $createBot, JoinGameAction $joinAction): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $game->isInLobby()) {
            return response()->json(['error' => 'Kan bare legge til boter i lobbyen.'], 422);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan legge til boter.'], 403);
        }

        try {
            $bot = $createBot->execute();
            $joinAction->execute($game, $bot);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Kunne ikke legge til bot: '.$e->getMessage()], 422);
        }

        $game->touch();

        try {
            broadcast(new PlayerJoinedBroadcast($game, $bot))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: player.joined (bot)', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'player' => [
                'id' => $bot->id,
                'nickname' => $bot->nickname,
                'is_bot' => true,
                'score' => 0,
                'is_host' => false,
                'is_co_host' => false,
            ],
        ]);
    }

    public function removeBot(Request $request, string $code, string $playerId, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $game->isInLobby()) {
            return response()->json(['error' => 'Kan bare fjerne boter i lobbyen.'], 422);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan fjerne boter.'], 403);
        }

        $botPlayer = Player::find($playerId);
        if (! $botPlayer || ! $botPlayer->is_bot) {
            return response()->json(['error' => 'Spilleren er ikke en bot.'], 422);
        }

        $gamePlayer = $game->gamePlayers()
            ->where('player_id', $playerId)
            ->where('is_active', true)
            ->first();

        if (! $gamePlayer) {
            return response()->json(['error' => 'Boten ble ikke funnet i dette spillet.'], 404);
        }

        $gamePlayer->update(['is_active' => false]);
        $game->touch();

        try {
            broadcast(new PlayerLeftBroadcast($game, $botPlayer))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: player.left (bot)', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'player_id' => $playerId,
        ]);
    }

    public function keepalive(Request $request, string $code, GetGameByCodeAction $getGame): JsonResponse
    {
        $game = $getGame->execute($code);

        if (! $game || ! $game->isInLobby()) {
            return response()->json(['error' => 'Spillet ble ikke funnet eller er ikke i lobbyen.'], 404);
        }

        $game->touch();

        return response()->json(['success' => true]);
    }

    public function rematch(Request $request, string $code, GetGameByCodeAction $getGame, CreateGameAction $createAction, JoinGameAction $joinAction): JsonResponse
    {
        $player = $request->attributes->get('player');
        $oldGame = $getGame->execute($code);

        if (! $oldGame) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $oldGame->isFinished()) {
            return response()->json(['error' => 'Spillet er ikke avsluttet.'], 422);
        }

        if (! $oldGame->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan starte omkamp.'], 403);
        }

        // Create new game with same settings (forward hashed password + plain text)
        $newGame = $createAction->execute(
            $player,
            $oldGame->settings,
            $oldGame->is_public,
            $oldGame->password,
            true,
            $oldGame->password_text,
        );

        // Auto-join all other active players from the old game
        $otherPlayers = $oldGame->activePlayers()->where('players.id', '!=', $player->id)->get();
        foreach ($otherPlayers as $otherPlayer) {
            try {
                $joinAction->execute($newGame, $otherPlayer, skipPassword: true);
            } catch (\Throwable $e) {
                Log::warning('Rematch: Failed to auto-join player', [
                    'player_id' => $otherPlayer->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Broadcast rematch to old game channel so all clients redirect
        try {
            broadcast(new GameRematchBroadcast($oldGame, $newGame->code));
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: game.rematch', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'game' => $this->formatGame($newGame->fresh()),
        ]);
    }

    public function updateVisibility(Request $request, string $code, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan endre synlighet.'], 403);
        }

        $request->validate([
            'is_public' => 'required|boolean',
        ]);

        $updates = ['is_public' => $request->boolean('is_public')];

        // Clear password when making game public
        if ($request->boolean('is_public')) {
            $updates['password'] = null;
            $updates['password_text'] = null;
        }

        $game->update($updates);

        try {
            broadcast(new GameSettingsChangedBroadcast($game, [
                'is_public' => $game->is_public,
                'has_password' => ! is_null($game->password),
                'changed_by' => $player->nickname,
            ]))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: game.settings_changed', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'is_public' => $game->is_public,
            'has_password' => ! is_null($game->password),
        ]);
    }

    public function updateSettings(Request $request, string $code, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $game->isHostOrCoHost($player)) {
            return response()->json(['error' => 'Bare verten eller medverten kan endre innstillinger.'], 403);
        }

        // Settings that can be changed during play
        $liveSettings = ['chat_enabled'];

        $validated = $request->validate([
            'settings' => ['sometimes', 'array'],
            'settings.rounds' => ['nullable', 'integer', 'min:1', 'max:20'],
            'settings.answer_time' => ['nullable', 'integer', 'min:15', 'max:300'],
            'settings.vote_time' => ['nullable', 'integer', 'min:10', 'max:120'],
            'settings.time_between_rounds' => ['nullable', 'integer', 'min:3', 'max:120'],
            'settings.max_players' => ['nullable', 'integer', 'min:2', 'max:16'],
            'settings.acronym_length_min' => ['nullable', 'integer', 'min:1', 'max:6'],
            'settings.acronym_length_max' => ['nullable', 'integer', 'min:1', 'max:6'],
            'settings.excluded_letters' => ['nullable', 'string', 'max:26'],
            'settings.weighted_acronyms' => ['nullable', 'boolean'],
            'settings.acronym_source' => ['nullable', 'string', 'in:random,weighted,gullkorn'],
            'settings.chat_enabled' => ['nullable', 'boolean'],
            'settings.max_edits' => ['nullable', 'integer', 'min:0', 'max:20'],
            'settings.max_vote_changes' => ['nullable', 'integer', 'min:0', 'max:20'],
            'settings.allow_ready_check' => ['nullable', 'boolean'],
            'is_public' => ['nullable', 'boolean'],
            'password' => ['nullable', 'string', 'min:4', 'max:50'],
        ]);

        // Outside lobby, only allow live-changeable settings + visibility + password
        if (! $game->isInLobby()) {
            $requestedSettings = array_keys(array_filter($validated['settings'] ?? [], fn ($v) => $v !== null));
            $lobbyOnly = array_diff($requestedSettings, $liveSettings);
            if (! empty($lobbyOnly)) {
                return response()->json(['error' => 'Bare chat og synlighet kan endres under spill.'], 422);
            }
        }

        $currentSettings = $game->settings ?? [];
        $newSettings = array_merge($currentSettings, array_filter($validated['settings'] ?? [], fn ($v) => $v !== null));

        // Cross-validate acronym length
        $minLen = $newSettings['acronym_length_min'] ?? 3;
        $maxLen = $newSettings['acronym_length_max'] ?? 6;
        if ($minLen > $maxLen) {
            return response()->json(['error' => 'Akronymets minimumslengde kan ikke overstige maksimumslengden.'], 422);
        }
        $game->settings = $newSettings;
        $game->total_rounds = $newSettings['rounds'] ?? $game->total_rounds;

        if (array_key_exists('is_public', $validated) && $validated['is_public'] !== null) {
            $game->is_public = $validated['is_public'];
        }

        $passwordChanged = ! empty($validated['password']);
        if ($passwordChanged) {
            $game->password = \Illuminate\Support\Facades\Hash::make($validated['password']);
            $game->password_text = $validated['password'];
        }

        $game->save();

        try {
            broadcast(new GameSettingsChangedBroadcast($game->fresh(), [
                'settings' => $game->settings,
                'is_public' => $game->is_public,
                'has_password' => ! is_null($game->password),
                'password_changed' => $passwordChanged,
                'new_password' => $passwordChanged ? $validated['password'] : null,
                'changed_by' => $player->nickname,
            ]))->toOthers();
        } catch (\Throwable $e) {
            Log::error('Broadcast failed: game.settings_changed', ['game' => $code, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'settings' => $game->settings,
            'is_public' => $game->is_public,
            'has_password' => ! is_null($game->password),
        ]);
    }

    public function invite(InvitePlayerRequest $request, string $code, GetGameByCodeAction $getGame): JsonResponse
    {
        $player = $request->attributes->get('player');
        $game = $getGame->execute($code);

        if (! $game) {
            return response()->json(['error' => 'Spillet ble ikke funnet.'], 404);
        }

        if (! $game->isInLobby()) {
            return response()->json(['error' => 'Invitasjoner kan bare sendes fra lobbyen.'], 422);
        }

        $isParticipant = $game->gamePlayers()
            ->where('player_id', $player->id)
            ->where('is_active', true)
            ->exists();

        if (! $isParticipant) {
            return response()->json(['error' => 'Bare spilldeltakere kan sende invitasjoner.'], 403);
        }

        // Rate limit: 5 invites per player per 10 minutes
        $rateLimitKey = 'game-invite:'.$player->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);

            return response()->json([
                'error' => 'For mange invitasjoner. Prøv igjen senere.',
                'retry_after' => $seconds,
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 600);

        $gameUrl = config('app.url').'/spill/'.$game->code;

        Mail::to($request->validated('email'))
            ->send(new GameInviteMail($player, $game, $gameUrl));

        $remaining = 5 - RateLimiter::attempts($rateLimitKey);

        return response()->json([
            'sent' => true,
            'invites_remaining' => max(0, $remaining),
        ]);
    }

    private function derivePhase(Game $game, ?Round $round): string
    {
        if ($game->isInLobby()) {
            return 'lobby';
        }

        if ($game->isFinished()) {
            return 'finished';
        }

        if (! $round) {
            return 'results';
        }

        return match ($round->status) {
            'answering' => 'playing',
            'voting' => 'voting',
            'completed' => 'results',
            default => 'playing',
        };
    }

    private function formatGame($game): array
    {
        $players = $game->activePlayers()->with('user')->get()->map(fn ($p) => [
            'id' => $p->id,
            'nickname' => $p->nickname,
            'score' => $p->pivot->score,
            'is_host' => $p->id === $game->host_player_id,
            'is_co_host' => (bool) $p->pivot->is_co_host,
            'is_bot' => (bool) $p->is_bot,
            'avatar_url' => $p->user?->gravatarUrl(64),
        ]);

        $result = [
            'id' => $game->id,
            'code' => $game->code,
            'status' => $game->status,
            'host_player_id' => $game->host_player_id,
            'current_round' => $game->current_round,
            'total_rounds' => $game->total_rounds,
            'settings' => $game->settings,
            'is_public' => $game->is_public,
            'has_password' => ! is_null($game->password),
            'password_text' => $game->password_text,
            'players' => $players,
        ];

        // Include banned players for host visibility
        $bannedPlayers = $game->gamePlayers()
            ->whereNotNull('banned_by')
            ->with('player')
            ->get()
            ->map(fn ($gp) => [
                'id' => $gp->player_id,
                'nickname' => $gp->player->nickname,
                'ban_reason' => $gp->ban_reason,
            ]);
        $result['banned_players'] = $bannedPlayers;

        // Include winner info for finished games
        if ($game->isFinished()) {
            $gameResult = $game->gameResult;
            if ($gameResult) {
                $winner = collect($gameResult->final_scores)->firstWhere('is_winner', true);
                $result['winner'] = $winner;
            }
        }

        return $result;
    }
}
