import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Login from '../Login.vue';

const mockAuthStore = {
    createGuest: vi.fn(),
    login: vi.fn(),
    isAuthenticated: false,
    isGuest: false,
    nickname: null,
    player: null,
};

vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => mockAuthStore,
}));

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: vi.fn(),
        locale: { value: 'no' },
        isNorwegian: { value: true },
    }),
}));

vi.mock('../../services/api.js', () => ({
    api: {
        auth: { forgotPassword: vi.fn(), resetPassword: vi.fn() },
        profile: { updateNickname: vi.fn() },
    },
}));

import { router } from '@inertiajs/vue3';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: {
        template: '<input :id="$attrs.id" :value="$attrs.modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        inheritAttrs: false,
        emits: ['update:modelValue'],
    },
    Password: {
        template: '<input type="password" :id="$attrs.id" :value="$attrs.modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        inheritAttrs: false,
        emits: ['update:modelValue'],
    },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

function mountLogin(props = {}) {
    return mount(Login, {
        props,
        global: {
            stubs,
        },
    });
}

describe('Login.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;
        mockAuthStore.nickname = null;
        mockAuthStore.player = null;
    });

    it('renders guest login section', () => {
        const wrapper = mountLogin();

        expect(wrapper.text()).toContain('auth.guest.title');
        expect(wrapper.text()).toContain('auth.guest.nickname');
        expect(wrapper.text()).toContain('auth.guest.submit');
    });

    it('renders login form with email and password', () => {
        const wrapper = mountLogin();

        expect(wrapper.text()).toContain('auth.login.title');
        expect(wrapper.text()).toContain('auth.login.email');
        expect(wrapper.text()).toContain('auth.login.password');
        expect(wrapper.text()).toContain('auth.login.submit');
    });

    it('shows game preview when gamePreview prop is provided', () => {
        const gamePreview = {
            code: 'ABCD',
            player_count: 3,
            players: ['Alice', 'Bob', 'Charlie'],
        };

        const wrapper = mountLogin({ gamePreview });

        expect(wrapper.text()).toContain('#ABCD');
        expect(wrapper.text()).toContain('auth.joiningGame');
        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');
        expect(wrapper.text()).toContain('Charlie');
    });

    it('does not show game preview when gamePreview prop is null', () => {
        const wrapper = mountLogin();

        expect(wrapper.text()).not.toContain('auth.joiningGame');
    });

    it('handleGuest does nothing when nickname is empty', async () => {
        const wrapper = mountLogin();

        const guestForm = wrapper.findAll('form')[0];
        await guestForm.trigger('submit');

        expect(mockAuthStore.createGuest).not.toHaveBeenCalled();
    });

    it('handleGuest does nothing when nickname is whitespace only', async () => {
        const wrapper = mountLogin();

        const guestInput = wrapper.find('#guestNickname');
        await guestInput.setValue('   ');

        const guestForm = wrapper.findAll('form')[0];
        await guestForm.trigger('submit');

        expect(mockAuthStore.createGuest).not.toHaveBeenCalled();
    });

    it('handleGuest calls createGuest and redirects on success', async () => {
        mockAuthStore.createGuest.mockResolvedValue({});

        const wrapper = mountLogin();

        const guestInput = wrapper.find('#guestNickname');
        await guestInput.setValue('TestPlayer');

        const guestForm = wrapper.findAll('form')[0];
        await guestForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.createGuest).toHaveBeenCalledWith('TestPlayer');
        });

        expect(router.visit).toHaveBeenCalledWith('/spill');
    });

    it('getSafeRedirect uses URL redirect param when present', async () => {
        // Set redirect query param on window.location
        const originalSearch = window.location.search;
        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?redirect=/spill/ABCD' },
            writable: true,
            configurable: true,
        });

        mockAuthStore.createGuest.mockResolvedValue({});

        const wrapper = mountLogin();

        const guestInput = wrapper.find('#guestNickname');
        await guestInput.setValue('Player');

        const guestForm = wrapper.findAll('form')[0];
        await guestForm.trigger('submit');
        await vi.waitFor(() => {
            expect(router.visit).toHaveBeenCalledWith('/spill/ABCD');
        });

        // Restore
        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: originalSearch },
            writable: true,
            configurable: true,
        });
    });

    it('shows two-factor input on 423 response', async () => {
        const error423 = new Error('Two-factor required');
        error423.response = { status: 423, data: {} };
        mockAuthStore.login.mockRejectedValue(error423);

        const wrapper = mountLogin();

        // Fill in email and password
        const emailInput = wrapper.find('#email');
        await emailInput.setValue('test@example.com');

        const passwordInput = wrapper.find('#password');
        await passwordInput.setValue('password123');

        // Two-factor input should not be visible initially
        expect(wrapper.find('#twoFactorCode').exists()).toBe(false);

        // Submit login form
        const loginForm = wrapper.findAll('form')[1];
        await loginForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.login).toHaveBeenCalled();
        });

        // Two-factor input should now be visible
        expect(wrapper.find('#twoFactorCode').exists()).toBe(true);
        expect(wrapper.text()).toContain('auth.login.twoFactor');
    });

    it('shows field errors on 422 response', async () => {
        const error422 = new Error('Validation error');
        error422.response = {
            status: 422,
            data: {
                errors: {
                    email: ['The email field is required.'],
                    password: ['The password field is required.'],
                },
            },
        };
        mockAuthStore.login.mockRejectedValue(error422);

        const wrapper = mountLogin();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('bad@email');

        const passwordInput = wrapper.find('#password');
        await passwordInput.setValue('short');

        const loginForm = wrapper.findAll('form')[1];
        await loginForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.login).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('The email field is required.');
        expect(wrapper.text()).toContain('The password field is required.');
    });

    it('shows generic error message on non-422/non-423 response', async () => {
        const error500 = new Error('Server error');
        error500.response = {
            status: 500,
            data: { message: 'Internal server error' },
        };
        mockAuthStore.login.mockRejectedValue(error500);

        const wrapper = mountLogin();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('test@example.com');

        const passwordInput = wrapper.find('#password');
        await passwordInput.setValue('password123');

        const loginForm = wrapper.findAll('form')[1];
        await loginForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.login).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('Internal server error');
    });

    it('renders forgot password and register links', () => {
        const wrapper = mountLogin();

        expect(wrapper.text()).toContain('auth.login.forgotPassword');
        expect(wrapper.text()).toContain('auth.login.noAccount');
        expect(wrapper.text()).toContain('auth.login.register');
    });
});
