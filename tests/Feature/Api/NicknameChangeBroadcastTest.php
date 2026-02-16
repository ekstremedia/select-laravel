<?php

namespace Tests\Feature\Api;

use App\Application\Broadcasting\Events\PlayerNicknameChangedBroadcast;
use App\Infrastructure\Models\Player;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class NicknameChangeBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_nickname_change_broadcasts_to_active_games(): void
    {
        Event::fake([PlayerNicknameChangedBroadcast::class]);

        // Create host player and game
        $hostResponse = $this->postJson('/api/v1/auth/guest', [
            'nickname' => 'Host',
        ]);
        $hostToken = $hostResponse->json('player.guest_token');

        $gameResponse = $this->withHeaders([
            'X-Guest-Token' => $hostToken,
        ])->postJson('/api/v1/games');

        $gameCode = $gameResponse->json('game.code');

        // Create a second player and join the game
        $guestResponse = $this->postJson('/api/v1/auth/guest', [
            'nickname' => 'OldName',
        ]);
        $guestToken = $guestResponse->json('player.guest_token');

        $this->withHeaders([
            'X-Guest-Token' => $guestToken,
        ])->postJson("/api/v1/games/{$gameCode}/join");

        // Change nickname
        $this->patchJson('/api/v1/profile/nickname', [
            'nickname' => 'NewName',
        ], [
            'X-Guest-Token' => $guestToken,
        ])->assertStatus(200);

        Event::assertDispatched(PlayerNicknameChangedBroadcast::class, function ($event) {
            return $event->oldNickname === 'OldName' && $event->newNickname === 'NewName';
        });
    }

    public function test_nickname_change_does_not_broadcast_without_active_game(): void
    {
        Event::fake([PlayerNicknameChangedBroadcast::class]);

        $guestResponse = $this->postJson('/api/v1/auth/guest', [
            'nickname' => 'Solo',
        ]);
        $guestToken = $guestResponse->json('player.guest_token');

        $this->patchJson('/api/v1/profile/nickname', [
            'nickname' => 'SoloNew',
        ], [
            'X-Guest-Token' => $guestToken,
        ])->assertStatus(200);

        Event::assertNotDispatched(PlayerNicknameChangedBroadcast::class);
    }

    public function test_nickname_change_updates_player_in_database(): void
    {
        $guestResponse = $this->postJson('/api/v1/auth/guest', [
            'nickname' => 'Before',
        ]);
        $guestToken = $guestResponse->json('player.guest_token');
        $playerId = $guestResponse->json('player.id');

        $this->patchJson('/api/v1/profile/nickname', [
            'nickname' => 'After',
        ], [
            'X-Guest-Token' => $guestToken,
        ])->assertStatus(200);

        $this->assertEquals('After', Player::find($playerId)->nickname);
    }
}
