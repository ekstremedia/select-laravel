<?php

namespace App\Application\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
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
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'name' => ['nullable', 'string', 'max:255'],
            'nickname' => ['nullable', 'string', 'min:3', 'max:20', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:users,nickname'],
            'guest_token' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nickname.regex' => 'Kallenavn kan kun inneholde bokstaver, tall og understrek.',
            'nickname.unique' => 'Kallenavnet er allerede i bruk.',
            'email.unique' => 'E-postadressen er allerede i bruk.',
            'password.min' => 'Passordet må være minst 8 tegn.',
            'password.confirmed' => 'Passordbekreftelsen stemmer ikke.',
        ];
    }
}
