import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ResetPassword from '../ResetPassword.vue';

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

import { api } from '../../services/api.js';
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

function mountResetPassword(props = {}) {
    return mount(ResetPassword, {
        props: {
            token: 'test-reset-token',
            ...props,
        },
        global: {
            stubs,
        },
    });
}

describe('ResetPassword.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders form with email, new password, and confirm password', () => {
        const wrapper = mountResetPassword();

        expect(wrapper.text()).toContain('auth.resetPassword.title');
        expect(wrapper.text()).toContain('auth.login.email');
        expect(wrapper.text()).toContain('auth.resetPassword.newPassword');
        expect(wrapper.text()).toContain('auth.resetPassword.confirmPassword');
        expect(wrapper.text()).toContain('auth.resetPassword.submit');
    });

    it('on success, shows success message and login link', async () => {
        api.auth.resetPassword.mockResolvedValue({});

        const wrapper = mountResetPassword();

        await wrapper.find('#email').setValue('test@example.com');
        await wrapper.find('#password').setValue('newpassword123');
        await wrapper.find('#password_confirmation').setValue('newpassword123');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalled();
        });

        // Success message should be visible
        expect(wrapper.text()).toContain('auth.resetPassword.success');

        // Login link should be visible
        const loginLink = wrapper.find('a[href="/logg-inn"]');
        expect(loginLink.exists()).toBe(true);
        expect(wrapper.text()).toContain('auth.login.title');

        // Form should be hidden
        expect(wrapper.find('form').exists()).toBe(false);
    });

    it('passes token prop to api.auth.resetPassword call', async () => {
        api.auth.resetPassword.mockResolvedValue({});

        const wrapper = mountResetPassword({ token: 'my-special-token' });

        await wrapper.find('#email').setValue('test@example.com');
        await wrapper.find('#password').setValue('newpassword123');
        await wrapper.find('#password_confirmation').setValue('newpassword123');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalledWith({
                token: 'my-special-token',
                email: 'test@example.com',
                password: 'newpassword123',
                password_confirmation: 'newpassword123',
            });
        });
    });

    it('on 422, shows field errors', async () => {
        const error422 = new Error('Validation error');
        error422.response = {
            status: 422,
            data: {
                errors: {
                    email: ['The email field is required.'],
                    password: ['The password must be at least 8 characters.'],
                },
            },
        };
        api.auth.resetPassword.mockRejectedValue(error422);

        const wrapper = mountResetPassword();

        await wrapper.find('#email').setValue('');
        await wrapper.find('#password').setValue('short');
        await wrapper.find('#password_confirmation').setValue('short');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('The email field is required.');
        expect(wrapper.text()).toContain('The password must be at least 8 characters.');

        // Form should still be visible
        expect(wrapper.find('form').exists()).toBe(true);
    });

    it('shows generic error on non-422 response', async () => {
        const error500 = new Error('Server error');
        error500.response = {
            status: 500,
            data: { message: 'Token has expired' },
        };
        api.auth.resetPassword.mockRejectedValue(error500);

        const wrapper = mountResetPassword();

        await wrapper.find('#email').setValue('test@example.com');
        await wrapper.find('#password').setValue('newpassword123');
        await wrapper.find('#password_confirmation').setValue('newpassword123');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('Token has expired');
    });

    it('redirects to login after success with setTimeout', async () => {
        api.auth.resetPassword.mockResolvedValue({});

        const wrapper = mountResetPassword();

        await wrapper.find('#email').setValue('test@example.com');
        await wrapper.find('#password').setValue('newpassword123');
        await wrapper.find('#password_confirmation').setValue('newpassword123');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalled();
        });

        // router.visit should not have been called yet
        expect(router.visit).not.toHaveBeenCalled();

        // Advance timers by 3 seconds
        vi.advanceTimersByTime(3000);

        expect(router.visit).toHaveBeenCalledWith('/logg-inn');
    });

    it('clears previous field errors on new submission', async () => {
        const error422 = new Error('Validation error');
        error422.response = {
            status: 422,
            data: {
                errors: {
                    email: ['The email field is required.'],
                },
            },
        };
        api.auth.resetPassword.mockRejectedValueOnce(error422);
        api.auth.resetPassword.mockResolvedValueOnce({});

        const wrapper = mountResetPassword();

        // First submission - triggers error
        await wrapper.find('#email').setValue('');
        await wrapper.find('#password').setValue('pass');
        await wrapper.find('#password_confirmation').setValue('pass');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalledTimes(1);
        });

        expect(wrapper.text()).toContain('The email field is required.');

        // Second submission - should clear errors
        await wrapper.find('#email').setValue('test@example.com');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.resetPassword).toHaveBeenCalledTimes(2);
        });

        expect(wrapper.text()).not.toContain('The email field is required.');
    });
});
