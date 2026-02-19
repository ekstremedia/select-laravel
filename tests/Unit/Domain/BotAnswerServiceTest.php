<?php

namespace Tests\Unit\Domain;

use App\Domain\Round\Services\BotAnswerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BotAnswerServiceTest extends TestCase
{
    use RefreshDatabase;

    private BotAnswerService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new BotAnswerService;
    }

    public function test_generates_fallback_answer_matching_acronym(): void
    {
        $result = $this->service->findAnswer('ABC');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('text', $result);
        $this->assertArrayHasKey('gullkorn_id', $result);

        $words = preg_split('/\s+/', trim($result['text']));
        $this->assertCount(3, $words);
        $this->assertStringStartsWith('a', $words[0]);
        $this->assertStringStartsWith('b', $words[1]);
        $this->assertStringStartsWith('c', $words[2]);
    }

    public function test_generates_answer_for_single_letter(): void
    {
        $result = $this->service->findAnswer('A');

        $words = preg_split('/\s+/', trim($result['text']));
        $this->assertCount(1, $words);
        $this->assertStringStartsWith('a', $words[0]);
    }

    public function test_generates_answer_for_long_acronym(): void
    {
        $result = $this->service->findAnswer('ABCDEF');

        $words = preg_split('/\s+/', trim($result['text']));
        $this->assertCount(6, $words);
    }

    public function test_handles_lowercase_acronym(): void
    {
        $result = $this->service->findAnswer('abc');

        $words = preg_split('/\s+/', trim($result['text']));
        $this->assertCount(3, $words);
        $this->assertStringStartsWith('a', $words[0]);
        $this->assertStringStartsWith('b', $words[1]);
        $this->assertStringStartsWith('c', $words[2]);
    }

    public function test_handles_uncommon_letters(): void
    {
        $result = $this->service->findAnswer('QXZ');

        $words = preg_split('/\s+/', trim($result['text']));
        $this->assertCount(3, $words);
    }

    public function test_fallback_returns_null_gullkorn_id(): void
    {
        $result = $this->service->findAnswer('ABC');

        $this->assertNull($result['gullkorn_id']);
    }

    public function test_accepts_exclude_gullkorn_ids_parameter(): void
    {
        $result = $this->service->findAnswer('ABC', [1, 2, 3]);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('text', $result);
    }
}
