<?php

namespace App\Domain\Round\Actions;

use App\Application\Jobs\ProcessAnswerDeadlineJob;
use App\Domain\Round\Services\AcronymGenerator;
use App\Domain\Round\Services\GullkornAcronymService;
use App\Infrastructure\Models\Game;
use App\Infrastructure\Models\Round;

class StartRoundAction
{
    public function __construct(
        private AcronymGenerator $acronymGenerator,
        private GullkornAcronymService $gullkornAcronymService
    ) {}

    public function execute(Game $game): Round
    {
        $settings = $game->settings;
        $answerTime = $settings['answer_time'] ?? 60;
        $minLength = $settings['acronym_length_min'] ?? 3;
        $maxLength = $settings['acronym_length_max'] ?? 6;

        $excludedLetters = $settings['excluded_letters'] ?? '';
        $excludedArray = $excludedLetters
            ? array_map('strtoupper', str_split(preg_replace('/[^a-zA-Z]/', '', $excludedLetters)))
            : [];

        // Determine acronym source with backward compat
        $acronymSource = $settings['acronym_source']
            ?? (($settings['weighted_acronyms'] ?? false) ? 'weighted' : 'random');

        $acronym = null;
        $gullkornSourceId = null;
        $usedGullkornIds = null;

        if ($acronymSource === 'gullkorn') {
            $result = $this->gullkornAcronymService->generateFromGullkorn($minLength, $maxLength, $excludedArray);
            if ($result) {
                $acronym = $result['acronym'];
                $gullkornSourceId = $result['gullkorn_id'];
                // Initialize used IDs with the source sentence so bots don't repeat it
                $usedGullkornIds = [$result['gullkorn_id']];
            }
            // Fall back to weighted if no gullkorn match found
            if (! $acronym) {
                $acronymSource = 'weighted';
            }
        }

        if (! $acronym) {
            if ($excludedArray) {
                $this->acronymGenerator->setExcludedLetters($excludedLetters);
            }
            $this->acronymGenerator->setWeighted($acronymSource === 'weighted');
            $acronym = $this->acronymGenerator->generate($minLength, $maxLength);
        }

        $round = Round::create([
            'game_id' => $game->id,
            'round_number' => $game->current_round,
            'acronym' => $acronym,
            'status' => Round::STATUS_ANSWERING,
            'answer_deadline' => now()->addSeconds($answerTime),
            'gullkorn_source_id' => $gullkornSourceId,
            'used_gullkorn_ids' => $usedGullkornIds,
        ]);

        // Schedule deadline processing
        ProcessAnswerDeadlineJob::dispatch($round->id)
            ->delay(now()->addSeconds($answerTime + 2));

        return $round;
    }
}
