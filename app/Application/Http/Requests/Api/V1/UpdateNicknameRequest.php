<?php

namespace App\Application\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateNicknameRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $player = $this->attributes->get('player');

        return [
            'nickname' => [
                'required',
                'string',
                'min:3',
                'max:20',
                'regex:/^[a-zA-Z0-9_]+$/',
                Rule::unique('players', 'nickname')->ignore($player?->id),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nickname.regex' => 'Kallenavn kan kun inneholde bokstaver, tall og understrek.',
            'nickname.min' => 'Kallenavn må være minst 3 tegn.',
            'nickname.max' => 'Kallenavn kan ikke være mer enn 20 tegn.',
            'nickname.unique' => 'Kallenavnet er allerede i bruk.',
        ];
    }
}
