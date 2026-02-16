import { ref } from 'vue';
import { api } from '../services/api.js';
import { useAuthStore } from '../stores/authStore.js';
import { useI18n } from './useI18n.js';

/**
 * Composable for nickname change dialog logic.
 *
 * @param {Object} options
 * @param {Function} [options.onSuccess] - Called with the updated player data after successful save
 * @returns {Object} Dialog state and functions
 */
export function useNicknameDialog({ onSuccess } = {}) {
    const authStore = useAuthStore();
    const { t } = useI18n();

    const visible = ref(false);
    const newNickname = ref('');
    const error = ref('');
    const loading = ref(false);
    const inputRef = ref(null);

    function open() {
        newNickname.value = authStore.player?.nickname || '';
        error.value = '';
        visible.value = true;
        setTimeout(() => {
            const el = inputRef.value?.$el;
            if (el) {
                if (el.tagName === 'INPUT') el.focus();
                else el.querySelector?.('input')?.focus();
            }
        }, 350);
    }

    function close() {
        visible.value = false;
    }

    async function submit() {
        const trimmed = newNickname.value.trim();
        if (!trimmed) return;

        loading.value = true;
        error.value = '';

        try {
            const { data } = await api.profile.updateNickname(trimmed);
            authStore.player = { ...authStore.player, nickname: data.player.nickname };
            visible.value = false;
            onSuccess?.(data.player);
        } catch (err) {
            error.value =
                err.response?.data?.errors?.nickname?.[0] ||
                err.response?.data?.message ||
                t('common.error');
        } finally {
            loading.value = false;
        }
    }

    return {
        visible,
        newNickname,
        error,
        loading,
        inputRef,
        open,
        close,
        submit,
    };
}
