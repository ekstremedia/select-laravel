<?php

declare(strict_types=1);

namespace App\Domain\Round\Services;

use App\Infrastructure\Models\GullkornClean;
use Illuminate\Support\Facades\Log;

class GullkornAcronymService
{
    /**
     * Pick a random sentence from gullkorn_clean (with >5 votes) whose
     * initial letters form an acronym within the given length constraints,
     * and whose initials don't include any excluded letters.
     *
     * @return array{acronym: string, gullkorn_id: int}|null
     */
    public function generateFromGullkorn(int $minLength, int $maxLength, array $excludedLetters = []): ?array
    {
        try {
            $query = GullkornClean::query()
                ->where('stemmer', '>', 5)
                ->whereRaw("array_length(regexp_split_to_array(trim(setning), E'\\\\s+'), 1) >= ?", [$minLength])
                ->whereRaw("array_length(regexp_split_to_array(trim(setning), E'\\\\s+'), 1) <= ?", [$maxLength]);

            // Exclude sentences where any word starts with an excluded letter
            foreach ($excludedLetters as $letter) {
                $upper = strtoupper($letter);
                $lower = strtolower($letter);
                $query->whereRaw(
                    "NOT EXISTS (SELECT 1 FROM unnest(regexp_split_to_array(trim(setning), E'\\\\s+')) AS word WHERE left(word, 1) IN (?, ?))",
                    [$upper, $lower]
                );
            }

            $results = $query
                ->orderByDesc('stemmer')
                ->limit(50)
                ->get();

            if ($results->isEmpty()) {
                return null;
            }

            $sentence = $results->random();
            $words = preg_split('/\s+/', trim($sentence->setning));
            $acronym = implode('', array_map(fn ($w) => strtoupper(mb_substr($w, 0, 1)), $words));

            return [
                'acronym' => $acronym,
                'gullkorn_id' => $sentence->id,
            ];
        } catch (\Throwable $e) {
            Log::warning('GullkornAcronymService: query failed', ['error' => $e->getMessage()]);

            return null;
        }
    }
}
