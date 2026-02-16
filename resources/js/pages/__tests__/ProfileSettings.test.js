import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import ProfileSettings from '../ProfileSettings.vue';

const mockAuthStore = reactive({
    isAuthenticated: true,
    isGuest: false,
    isAdmin: false,
    nickname: 'TestUser',
    player: { nickname: 'TestUser' },
    user: { email: 'test@test.com', name: 'Test Name', gravatar_url: null },
    isInitialized: true,
    clearAuth: vi.fn(),
});

vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => mockAuthStore,
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: vi.fn(),
        locale: { value: 'no' },
        isNorwegian: { value: true },
    }),
}));

const mockUpdateProfile = vi.fn();
const mockUpdateNickname = vi.fn();
const mockUpdatePassword = vi.fn();
const mockDeleteAccount = vi.fn();
const mockEnableTwoFactor = vi.fn();
const mockDisableTwoFactor = vi.fn();

vi.mock('../../services/api.js', () => ({
    api: {
        profile: {
            update: (...args) => mockUpdateProfile(...args),
            updateNickname: (...args) => mockUpdateNickname(...args),
            updatePassword: (...args) => mockUpdatePassword(...args),
            deleteAccount: (...args) => mockDeleteAccount(...args),
        },
        auth: {
            twoFactor: {
                enable: (...args) => mockEnableTwoFactor(...args),
                disable: (...args) => mockDisableTwoFactor(...args),
            },
        },
    },
}));

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

import { router } from '@inertiajs/vue3';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" :loading="$attrs.loading" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: {
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        props: ['modelValue'],
        inheritAttrs: false,
    },
    Password: { template: '<input type="password" />', inheritAttrs: false },
    ToggleSwitch: {
        template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        props: ['modelValue'],
        inheritAttrs: false,
    },
    Dialog: {
        template: '<div v-if="visible" class="dialog"><slot /><slot name="footer" /></div>',
        props: ['visible'],
        inheritAttrs: false,
    },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
};

function mountProfileSettings() {
    return mount(ProfileSettings, {
        global: { stubs },
    });
}

describe('ProfileSettings.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockAuthStore.nickname = 'TestUser';
        mockAuthStore.player = { nickname: 'TestUser' };
        mockAuthStore.user = { email: 'test@test.com', name: 'Test Name', gravatar_url: null };
        mockAuthStore.clearAuth.mockReset();
    });

    it('renders user header with nickname and email', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('TestUser');
        expect(wrapper.text()).toContain('test@test.com');
    });

    it('shows edit buttons for each field', () => {
        const wrapper = mountProfileSettings();

        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        // Name, Nickname, Email, Password = 4 edit buttons
        expect(editButtons.length).toBe(4);
    });

    it('shows name value from authStore', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('Test Name');
    });

    it('shows nickname value from authStore', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('TestUser');
    });

    it('shows email value from authStore', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('test@test.com');
    });

    it('name edit form appears when clicking edit', async () => {
        const wrapper = mountProfileSettings();

        // Find the name section edit button (first edit button in the account section)
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[0].trigger('click');

        // Should now show a save button and cancel button in the name form
        expect(wrapper.text()).toContain('common.save');
        expect(wrapper.text()).toContain('common.cancel');
    });

    it('save name calls api and shows success', async () => {
        mockUpdateProfile.mockResolvedValue({
            data: { user: { name: 'New Name' } },
        });

        const wrapper = mountProfileSettings();

        // Click edit for name
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[0].trigger('click');

        // Find and submit the form
        const forms = wrapper.findAll('form');
        expect(forms.length).toBeGreaterThan(0);
        await forms[0].trigger('submit');
        await flushPromises();

        expect(mockUpdateProfile).toHaveBeenCalled();
        expect(wrapper.text()).toContain('profile.settings.saved');
    });

    it('save name shows error on failure', async () => {
        const error = new Error('Validation error');
        error.response = { data: { errors: { name: ['Name is required'] } } };
        mockUpdateProfile.mockRejectedValue(error);

        const wrapper = mountProfileSettings();

        // Click edit for name
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[0].trigger('click');

        // Submit the form
        const forms = wrapper.findAll('form');
        await forms[0].trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('Name is required');
    });

    it('nickname edit form appears when clicking edit', async () => {
        const wrapper = mountProfileSettings();

        // Second edit button is for nickname
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[1].trigger('click');

        expect(wrapper.text()).toContain('common.save');
        expect(wrapper.text()).toContain('common.cancel');
    });

    it('save nickname calls api and updates store', async () => {
        mockUpdateNickname.mockResolvedValue({
            data: { player: { nickname: 'NewNick' } },
        });

        const wrapper = mountProfileSettings();

        // Click edit for nickname
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[1].trigger('click');

        // Submit the nickname form
        const forms = wrapper.findAll('form');
        await forms[0].trigger('submit');
        await flushPromises();

        expect(mockUpdateNickname).toHaveBeenCalled();
        expect(wrapper.text()).toContain('profile.settings.saved');
    });

    it('email edit form appears when clicking edit', async () => {
        const wrapper = mountProfileSettings();

        // Third edit button is for email
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[2].trigger('click');

        expect(wrapper.text()).toContain('common.save');
        expect(wrapper.text()).toContain('common.cancel');
    });

    it('password edit form with current/new/confirm fields', async () => {
        const wrapper = mountProfileSettings();

        // Fourth edit button is for password
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[3].trigger('click');

        expect(wrapper.text()).toContain('profile.settings.currentPassword');
        expect(wrapper.text()).toContain('profile.settings.newPassword');
        expect(wrapper.text()).toContain('profile.settings.confirmPassword');
    });

    it('save password calls api', async () => {
        mockUpdatePassword.mockResolvedValue({});

        const wrapper = mountProfileSettings();

        // Open password edit
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[3].trigger('click');

        // Submit password form
        const forms = wrapper.findAll('form');
        const passwordForm = forms[forms.length - 1];
        await passwordForm.trigger('submit');
        await flushPromises();

        expect(mockUpdatePassword).toHaveBeenCalled();
    });

    it('cancel edit hides name form', async () => {
        const wrapper = mountProfileSettings();

        // Open name edit
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[0].trigger('click');

        // Should show save/cancel
        expect(wrapper.text()).toContain('common.save');

        // Click cancel
        const cancelBtn = wrapper.findAll('button').find((btn) => btn.text().includes('common.cancel'));
        await cancelBtn.trigger('click');

        // The form should be gone, edit button should be back
        const newEditButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        expect(newEditButtons.length).toBe(4);
    });

    it('cancel password edit clears form and hides it', async () => {
        const wrapper = mountProfileSettings();

        // Open password edit
        const editButtons = wrapper.findAll('button').filter((btn) => btn.text().includes('game.edit'));
        await editButtons[3].trigger('click');

        expect(wrapper.text()).toContain('profile.settings.currentPassword');

        // Click cancel
        const cancelBtn = wrapper.findAll('button').find((btn) => btn.text().includes('common.cancel'));
        await cancelBtn.trigger('click');

        // Password form labels should be gone
        expect(wrapper.text()).not.toContain('profile.settings.currentPassword');
    });

    it('delete account dialog opens on button click', async () => {
        const wrapper = mountProfileSettings();

        // Find the delete account button
        const deleteBtn = wrapper.findAll('button').find((btn) => btn.text().includes('profile.settings.deleteAccount'));
        expect(deleteBtn).toBeTruthy();
        await deleteBtn.trigger('click');

        // Dialog should now be visible
        expect(wrapper.find('.dialog').exists()).toBe(true);
        expect(wrapper.text()).toContain('common.confirm');
    });

    it('delete account confirms and redirects', async () => {
        mockDeleteAccount.mockResolvedValue({});

        const wrapper = mountProfileSettings();

        // Open delete dialog
        const deleteBtn = wrapper.findAll('button').find((btn) => btn.text().includes('profile.settings.deleteAccount'));
        await deleteBtn.trigger('click');

        // Click confirm in dialog
        const dialogConfirmBtn = wrapper.find('.dialog').findAll('button').find((btn) => btn.text().includes('common.confirm'));
        expect(dialogConfirmBtn).toBeTruthy();
        await dialogConfirmBtn.trigger('click');
        await flushPromises();

        expect(mockDeleteAccount).toHaveBeenCalled();
        expect(mockAuthStore.clearAuth).toHaveBeenCalled();
        expect(router.visit).toHaveBeenCalledWith('/');
    });

    it('delete account shows error on failure', async () => {
        const error = new Error('Failed');
        error.response = { data: { message: 'Cannot delete account' } };
        mockDeleteAccount.mockRejectedValue(error);

        const wrapper = mountProfileSettings();

        // Open delete dialog
        const deleteBtn = wrapper.findAll('button').find((btn) => btn.text().includes('profile.settings.deleteAccount'));
        await deleteBtn.trigger('click');

        // Click confirm
        const dialogConfirmBtn = wrapper.find('.dialog').findAll('button').find((btn) => btn.text().includes('common.confirm'));
        await dialogConfirmBtn.trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('Cannot delete account');
    });

    it('renders two-factor authentication section', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('profile.settings.twoFactor');
        expect(wrapper.text()).toContain('auth.login.twoFactorCode');
    });

    it('renders danger zone section', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('profile.settings.deleteAccount');
        expect(wrapper.text()).toContain('profile.settings.deleteWarning');
    });

    it('shows dash when name is empty', () => {
        mockAuthStore.user = { email: 'test@test.com', name: '', gravatar_url: null };

        const wrapper = mountProfileSettings();

        // The name field should show the dash character
        const nameSection = wrapper.findAll('.px-6.py-4')[0];
        expect(nameSection.text()).toContain('\u2014');
    });

    it('shows account section heading', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('profile.settings.account');
    });

    it('shows change password section heading', () => {
        const wrapper = mountProfileSettings();

        expect(wrapper.text()).toContain('profile.settings.changePassword');
    });
});
