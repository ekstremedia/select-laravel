import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Register from '../Register.vue';

const mockAuthStore = {
    createGuest: vi.fn(),
    register: vi.fn(),
    convertGuest: vi.fn(),
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

function mountRegister(props = {}) {
    return mount(Register, {
        props,
        global: {
            stubs,
        },
    });
}

describe('Register.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;
        mockAuthStore.nickname = null;
        mockAuthStore.player = null;
    });

    it('renders registration form with all fields', () => {
        const wrapper = mountRegister();

        expect(wrapper.text()).toContain('auth.register.title');
        expect(wrapper.text()).toContain('auth.register.name');
        expect(wrapper.text()).toContain('auth.register.email');
        expect(wrapper.text()).toContain('auth.register.nickname');
        expect(wrapper.text()).toContain('auth.register.password');
        expect(wrapper.text()).toContain('auth.register.confirmPassword');
        expect(wrapper.text()).toContain('auth.register.submit');
    });

    it('shows guest section at bottom when no gamePreview and not converting', () => {
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;

        const wrapper = mountRegister();

        expect(wrapper.text()).toContain('auth.guest.title');
        expect(wrapper.text()).toContain('auth.guest.nickname');
        expect(wrapper.text()).toContain('auth.guest.submit');
        expect(wrapper.text()).toContain('auth.or');
    });

    it('shows guest section on top when gamePreview is provided', () => {
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;

        const gamePreview = {
            code: 'WXYZ',
            player_count: 2,
            players: ['Alice', 'Bob'],
        };

        const wrapper = mountRegister({ gamePreview });

        // Game preview banner should be shown
        expect(wrapper.text()).toContain('#WXYZ');
        expect(wrapper.text()).toContain('auth.joiningGame');
        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');

        // Guest section should be visible (on top, before registration form)
        expect(wrapper.text()).toContain('auth.guest.title');
        expect(wrapper.text()).toContain('auth.quickJoin');
    });

    it('shows guest conversion notice when isConvertingGuest', () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = true;

        const wrapper = mountRegister();

        expect(wrapper.text()).toContain('auth.register.convertNotice');
        // Guest section should NOT be visible when converting
        expect(wrapper.text()).not.toContain('auth.guest.title');
    });

    it('does not show guest section when converting guest', () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = true;

        const wrapper = mountRegister();

        // Neither top nor bottom guest section should be visible
        expect(wrapper.text()).not.toContain('auth.guest.submit');
    });

    it('handleRegister calls convertGuest for authenticated guest', async () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = true;
        mockAuthStore.convertGuest.mockResolvedValue({});

        const wrapper = mountRegister();

        // Fill in the registration form
        await wrapper.find('#name').setValue('Test User');
        await wrapper.find('#email').setValue('test@example.com');
        await wrapper.find('#nickname').setValue('tester');
        await wrapper.find('#password').setValue('password123');
        await wrapper.find('#password_confirmation').setValue('password123');

        // Submit registration form
        const registrationForm = wrapper.find('form');
        await registrationForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.convertGuest).toHaveBeenCalled();
        });

        expect(mockAuthStore.register).not.toHaveBeenCalled();
        expect(router.visit).toHaveBeenCalledWith('/spill');
    });

    it('handleRegister calls register for unauthenticated user', async () => {
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;
        mockAuthStore.register.mockResolvedValue({});

        const wrapper = mountRegister();

        // Fill in the registration form
        await wrapper.find('#name').setValue('New User');
        await wrapper.find('#email').setValue('new@example.com');
        await wrapper.find('#nickname').setValue('newuser');
        await wrapper.find('#password').setValue('password123');
        await wrapper.find('#password_confirmation').setValue('password123');

        // Submit via the registration form (first form when no guest section on top)
        const forms = wrapper.findAll('form');
        // The registration form is the first form with @submit.prevent="handleRegister"
        // When not converting and no gamePreview, the registration form is first, guest form is second
        const registrationForm = forms[0];
        await registrationForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.register).toHaveBeenCalled();
        });

        expect(mockAuthStore.convertGuest).not.toHaveBeenCalled();
        expect(router.visit).toHaveBeenCalledWith('/spill');
    });

    it('shows field errors on 422 response', async () => {
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;

        const error422 = new Error('Validation error');
        error422.response = {
            status: 422,
            data: {
                errors: {
                    email: ['The email has already been taken.'],
                    nickname: ['The nickname has already been taken.'],
                    password: ['The password must be at least 8 characters.'],
                },
            },
        };
        mockAuthStore.register.mockRejectedValue(error422);

        const wrapper = mountRegister();

        await wrapper.find('#name').setValue('User');
        await wrapper.find('#email').setValue('taken@example.com');
        await wrapper.find('#nickname').setValue('taken');
        await wrapper.find('#password').setValue('short');
        await wrapper.find('#password_confirmation').setValue('short');

        const registrationForm = wrapper.findAll('form')[0];
        await registrationForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.register).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('The email has already been taken.');
        expect(wrapper.text()).toContain('The nickname has already been taken.');
        expect(wrapper.text()).toContain('The password must be at least 8 characters.');
    });

    it('shows generic error on non-422 response', async () => {
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;

        const error500 = new Error('Server error');
        error500.response = {
            status: 500,
            data: { message: 'Something went wrong' },
        };
        mockAuthStore.register.mockRejectedValue(error500);

        const wrapper = mountRegister();

        await wrapper.find('#name').setValue('User');
        await wrapper.find('#email').setValue('test@example.com');
        await wrapper.find('#nickname').setValue('user');
        await wrapper.find('#password').setValue('password123');
        await wrapper.find('#password_confirmation').setValue('password123');

        const registrationForm = wrapper.findAll('form')[0];
        await registrationForm.trigger('submit');
        await vi.waitFor(() => {
            expect(mockAuthStore.register).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('Something went wrong');
    });

    it('renders login link', () => {
        const wrapper = mountRegister();

        expect(wrapper.text()).toContain('auth.register.hasAccount');
        expect(wrapper.text()).toContain('auth.register.login');
    });

    it('handleGuest does nothing when nickname is empty', async () => {
        const wrapper = mountRegister();

        // Find the guest form (second form when no gamePreview)
        const forms = wrapper.findAll('form');
        const guestForm = forms[1];
        await guestForm.trigger('submit');

        expect(mockAuthStore.createGuest).not.toHaveBeenCalled();
    });
});
