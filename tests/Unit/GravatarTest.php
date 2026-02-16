<?php

namespace Tests\Unit;

use App\Models\User;
use PHPUnit\Framework\TestCase;

class GravatarTest extends TestCase
{
    public function test_gravatar_url_generates_correct_hash(): void
    {
        $user = new User;
        $user->email = 'test@example.com';

        $expectedHash = md5('test@example.com');
        $url = $user->gravatarUrl();

        $this->assertEquals("https://www.gravatar.com/avatar/{$expectedHash}?s=80&d=404", $url);
    }

    public function test_gravatar_url_normalizes_email_case(): void
    {
        $user = new User;
        $user->email = 'Test@EXAMPLE.com';

        $expectedHash = md5('test@example.com');
        $url = $user->gravatarUrl();

        $this->assertEquals("https://www.gravatar.com/avatar/{$expectedHash}?s=80&d=404", $url);
    }

    public function test_gravatar_url_trims_whitespace(): void
    {
        $user = new User;
        $user->email = '  test@example.com  ';

        $expectedHash = md5('test@example.com');
        $url = $user->gravatarUrl();

        $this->assertEquals("https://www.gravatar.com/avatar/{$expectedHash}?s=80&d=404", $url);
    }

    public function test_gravatar_url_respects_custom_size(): void
    {
        $user = new User;
        $user->email = 'test@example.com';

        $url = $user->gravatarUrl(160);

        $this->assertStringContainsString('s=160', $url);
    }

    public function test_gravatar_url_uses_404_default(): void
    {
        $user = new User;
        $user->email = 'test@example.com';

        $url = $user->gravatarUrl();

        $this->assertStringContainsString('d=404', $url);
    }
}
