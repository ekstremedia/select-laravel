import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUpdateNickname = vi.fn();
vi.mock('../../services/api.js', () => ({
    api: {
        profile: {
            updateNickname: (...args) => mockUpdateNickname(...args),
        },
    },
}));

const mockAuthStore = {
    player: { id: 1, nickname: 'OldNick', is_guest: true },
};
vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => mockAuthStore,
}));

vi.mock('../useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

import { useNicknameDialog } from '../useNicknameDialog.js';

describe('useNicknameDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthStore.player = { id: 1, nickname: 'OldNick', is_guest: true };
    });

    it('initializes with correct defaults', () => {
        const dialog = useNicknameDialog();

        expect(dialog.visible.value).toBe(false);
        expect(dialog.newNickname.value).toBe('');
        expect(dialog.error.value).toBe('');
        expect(dialog.loading.value).toBe(false);
    });

    it('open sets visible and populates nickname from auth store', () => {
        const dialog = useNicknameDialog();
        dialog.open();

        expect(dialog.visible.value).toBe(true);
        expect(dialog.newNickname.value).toBe('OldNick');
        expect(dialog.error.value).toBe('');
    });

    it('close sets visible to false', () => {
        const dialog = useNicknameDialog();
        dialog.open();
        dialog.close();

        expect(dialog.visible.value).toBe(false);
    });

    it('submit does nothing when nickname is empty', async () => {
        const dialog = useNicknameDialog();
        dialog.open();
        dialog.newNickname.value = '   ';

        await dialog.submit();

        expect(mockUpdateNickname).not.toHaveBeenCalled();
    });

    it('submit calls API and updates auth store on success', async () => {
        mockUpdateNickname.mockResolvedValue({
            data: { player: { nickname: 'NewNick' } },
        });

        const dialog = useNicknameDialog();
        dialog.open();
        dialog.newNickname.value = 'NewNick';

        await dialog.submit();

        expect(mockUpdateNickname).toHaveBeenCalledWith('NewNick');
        expect(mockAuthStore.player.nickname).toBe('NewNick');
        expect(dialog.visible.value).toBe(false);
        expect(dialog.loading.value).toBe(false);
    });

    it('submit calls onSuccess callback with player data', async () => {
        const onSuccess = vi.fn();
        mockUpdateNickname.mockResolvedValue({
            data: { player: { nickname: 'NewNick' } },
        });

        const dialog = useNicknameDialog({ onSuccess });
        dialog.open();
        dialog.newNickname.value = 'NewNick';

        await dialog.submit();

        expect(onSuccess).toHaveBeenCalledWith({ nickname: 'NewNick' });
    });

    it('submit sets error on API failure', async () => {
        mockUpdateNickname.mockRejectedValue({
            response: { data: { errors: { nickname: ['Too short'] } } },
        });

        const dialog = useNicknameDialog();
        dialog.open();
        dialog.newNickname.value = 'X';

        await dialog.submit();

        expect(dialog.error.value).toBe('Too short');
        expect(dialog.visible.value).toBe(true);
        expect(dialog.loading.value).toBe(false);
    });

    it('submit uses message fallback when no field errors', async () => {
        mockUpdateNickname.mockRejectedValue({
            response: { data: { message: 'Server error' } },
        });

        const dialog = useNicknameDialog();
        dialog.open();
        dialog.newNickname.value = 'Something';

        await dialog.submit();

        expect(dialog.error.value).toBe('Server error');
    });

    it('submit uses t(common.error) as last fallback', async () => {
        mockUpdateNickname.mockRejectedValue({ response: { data: {} } });

        const dialog = useNicknameDialog();
        dialog.open();
        dialog.newNickname.value = 'Something';

        await dialog.submit();

        expect(dialog.error.value).toBe('common.error');
    });
});
