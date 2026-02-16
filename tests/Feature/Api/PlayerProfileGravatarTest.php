<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlayerProfileGravatarTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_includes_gravatar_url_for_registered_user(): void
    {
        $user = User::create([
            'name' => 'Profile User',
            'nickname' => 'ProfileUser',
            'email' => 'profile@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->getJson("/api/v1/players/{$user->nickname}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'player' => ['avatar_url'],
            ]);

        $expectedHash = md5('profile@example.com');
        $this->assertStringContainsString($expectedHash, $response->json('player.avatar_url'));
        $this->assertStringContainsString('s=160', $response->json('player.avatar_url'));
    }
}
