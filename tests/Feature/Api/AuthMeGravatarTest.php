<?php

namespace Tests\Feature\Api;

use App\Infrastructure\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthMeGravatarTest extends TestCase
{
    use RefreshDatabase;

    public function test_me_includes_gravatar_url_for_registered_user(): void
    {
        $user = User::create([
            'name' => 'Test User',
            'nickname' => 'TestUser',
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);

        Player::create([
            'user_id' => $user->id,
            'nickname' => 'TestUser',
            'is_guest' => false,
        ]);

        $token = $user->createToken('api')->plainTextToken;

        $response = $this->getJson('/api/v1/auth/me', [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => ['gravatar_url'],
            ]);

        $expectedHash = md5('test@example.com');
        $this->assertStringContainsString($expectedHash, $response->json('user.gravatar_url'));
    }

    public function test_me_does_not_include_gravatar_url_for_guest(): void
    {
        $guestResponse = $this->postJson('/api/v1/auth/guest', [
            'nickname' => 'GuestPlayer',
        ]);

        $guestToken = $guestResponse->json('player.guest_token');

        $response = $this->getJson('/api/v1/auth/me', [
            'X-Guest-Token' => $guestToken,
        ]);

        $response->assertStatus(200)
            ->assertJsonMissing(['gravatar_url']);
    }
}
