import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ForgotPassword from '../ForgotPassword.vue';

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
        auth: { forgotPassword: vi.fn() },
    },
}));

import { api } from '../../services/api.js';

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

function mountForgotPassword() {
    return mount(ForgotPassword, {
        global: {
            stubs,
        },
    });
}

describe('ForgotPassword.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('renders email input and submit button', () => {
        const wrapper = mountForgotPassword();

        expect(wrapper.text()).toContain('auth.forgotPassword.title');
        expect(wrapper.text()).toContain('auth.forgotPassword.description');
        expect(wrapper.text()).toContain('auth.login.email');
        expect(wrapper.text()).toContain('auth.forgotPassword.submit');
    });

    it('renders back link', () => {
        const wrapper = mountForgotPassword();

        expect(wrapper.text()).toContain('common.back');
        const backLink = wrapper.find('a[href="/logg-inn"]');
        expect(backLink.exists()).toBe(true);
    });

    it('handleSubmit does nothing when email is empty', async () => {
        const wrapper = mountForgotPassword();

        const form = wrapper.find('form');
        await form.trigger('submit');

        expect(api.auth.forgotPassword).not.toHaveBeenCalled();
    });

    it('handleSubmit does nothing when email is whitespace only', async () => {
        const wrapper = mountForgotPassword();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('   ');

        const form = wrapper.find('form');
        await form.trigger('submit');

        expect(api.auth.forgotPassword).not.toHaveBeenCalled();
    });

    it('on success, sets sent=true and shows success message, hides form', async () => {
        api.auth.forgotPassword.mockResolvedValue({});

        const wrapper = mountForgotPassword();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('test@example.com');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.forgotPassword).toHaveBeenCalledWith('test@example.com');
        });

        // Success message should be visible
        expect(wrapper.text()).toContain('auth.forgotPassword.sent');

        // Form should be hidden
        expect(wrapper.find('form').exists()).toBe(false);
    });

    it('on error, shows error message', async () => {
        const error = new Error('Request failed');
        error.response = {
            status: 429,
            data: { message: 'Too many requests' },
        };
        api.auth.forgotPassword.mockRejectedValue(error);

        const wrapper = mountForgotPassword();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('test@example.com');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.forgotPassword).toHaveBeenCalled();
        });

        expect(wrapper.text()).toContain('Too many requests');

        // Form should still be visible
        expect(wrapper.find('form').exists()).toBe(true);
    });

    it('shows fallback error message when no message in response', async () => {
        const error = new Error('Network error');
        error.response = undefined;
        api.auth.forgotPassword.mockRejectedValue(error);

        const wrapper = mountForgotPassword();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('test@example.com');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.forgotPassword).toHaveBeenCalled();
        });

        // Falls back to t('common.error')
        expect(wrapper.text()).toContain('common.error');
    });

    it('trims email before submitting', async () => {
        api.auth.forgotPassword.mockResolvedValue({});

        const wrapper = mountForgotPassword();

        const emailInput = wrapper.find('#email');
        await emailInput.setValue('  test@example.com  ');

        const form = wrapper.find('form');
        await form.trigger('submit');
        await vi.waitFor(() => {
            expect(api.auth.forgotPassword).toHaveBeenCalledWith('test@example.com');
        });
    });
});
