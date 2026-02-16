<?php

namespace App\Application\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class GuestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'nickname' => ['required', 'string', 'min:3', 'max:20', 'regex:/^[a-zA-Z0-9_]+$/'],
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
        ];
    }
}
