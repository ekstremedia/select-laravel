<template>
    <div class="flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" :style="{ height: `${viewportHeight}px` }">
        <!-- Minimal game header -->
        <header ref="headerRef" class="relative flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm shrink-0 z-20">
            <div class="flex items-center gap-3">
                <Link href="/spill" class="text-sm font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                    SELECT
                </Link>
                <span class="text-sm font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <svg v-if="isPrivate" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 text-amber-500 dark:text-amber-400"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" /></svg>
                    #{{ gameCode }}
                </span>
                <span v-if="gameStore.currentGame?.password_text" class="text-xs font-mono text-amber-500 dark:text-amber-400 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clip-rule="evenodd" /></svg>
                    {{ gameStore.currentGame.password_text }}
                </span>
            </div>
            <div class="flex items-center gap-3">
                <button
                    type="button"
                    class="flex items-center gap-1 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 hover:text-fuchsia-700 dark:hover:text-fuchsia-300 transition-colors"
                    @click="toggleDropdown"
                >
                    {{ playerCount }}/{{ maxPlayers }}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
                        <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                    </svg>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="w-3 h-3 transition-transform duration-200"
                        :class="{ 'rotate-180': dropdownOpen }"
                    >
                        <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                    </svg>
                </button>
                <button
                    type="button"
                    class="settings-cog p-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    @click="toggleSettings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-slate-500 dark:text-slate-400">
                        <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                    </svg>
                </button>
                <Button
                    :label="leaveLabel || t('game.leave')"
                    size="small"
                    severity="secondary"
                    variant="text"
                    @click="$emit('leave')"
                />
            </div>
        </header>

        <!-- Game content -->
        <main class="flex-1 overflow-hidden">
            <slot />
        </main>

        <!-- Player list dropdown (teleported to avoid overflow clipping) -->
        <Teleport to="body">
            <div v-if="dropdownVisible" class="fixed inset-0 z-[99]" @click="closeDropdown">
                <div
                    ref="dropdownRef"
                    class="absolute left-0 right-0 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm shadow-lg overflow-hidden"
                    :style="{ top: headerHeight + 'px' }"
                    @click.stop
                >
                    <div class="max-w-md mx-auto px-4 py-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {{ t(playerCount === 1 ? 'common.player' : 'common.players') }}
                            </span>
                            <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{{ playerCount }}/{{ maxPlayers }}</span>
                        </div>
                        <div class="space-y-0.5">
                            <div
                                v-for="player in players"
                                :key="player.id"
                                class="player-row"
                            >
                                <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <PlayerAvatar :nickname="player.nickname" :avatar-url="player.avatar_url" size="xs" />
                                    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ player.nickname }}</span>
                                    <Badge v-if="player.id === hostPlayerId" :value="t('lobby.host')" severity="success" class="ml-auto" />
                                    <Badge v-else-if="player.is_co_host" :value="t('lobby.coHost')" severity="info" class="ml-auto" />
                                    <button
                                        v-if="canManagePlayer(player)"
                                        class="player-action-cog ml-auto p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        :class="{ 'ml-2': player.is_co_host }"
                                        @click.stop="togglePlayerActions(player.id)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 text-slate-400">
                                            <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                                        </svg>
                                    </button>
                                </div>
                                <!-- Player action menu -->
                                <div v-if="playerActionOpenId === player.id" class="ml-8 mr-2 mb-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <button
                                        class="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-amber-600 dark:text-amber-400"
                                        @click="handleKickPlayer(player)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.578 5.384-1.573.398-.254.628-.707.57-1.175a6.001 6.001 0 0 0-11.908 0ZM12.75 7.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" /></svg>
                                        {{ t('lobby.kick') }}
                                    </button>
                                    <button
                                        class="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2 text-red-600 dark:text-red-400"
                                        @click="handleBanPlayer(player)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" /></svg>
                                        {{ t('lobby.ban') }}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p v-if="players.length === 0" class="text-xs text-slate-400 py-1">
                            {{ t('lobby.noPlayers') }}
                        </p>
                        <!-- Banned players -->
                        <div v-if="canManagePlayers && gameStore.currentGame?.banned_players?.length" class="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <span class="text-xs font-semibold uppercase tracking-wider text-red-400 dark:text-red-500 mb-1 block">{{ t('lobby.bannedPlayers') }}</span>
                            <div
                                v-for="bp in gameStore.currentGame.banned_players"
                                :key="bp.id"
                                class="player-row flex items-center justify-between px-2 py-1.5 rounded-lg"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium text-slate-500 dark:text-slate-400 line-through">{{ bp.nickname }}</span>
                                    <span v-if="bp.ban_reason" class="text-xs text-slate-400">{{ bp.ban_reason }}</span>
                                </div>
                                <button
                                    class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                                    @click="handleUnbanPlayer(bp.id)"
                                >
                                    {{ t('lobby.unban') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Settings dropdown (teleported to avoid overflow clipping) -->
        <Teleport to="body">
            <div v-if="settingsVisible" class="fixed inset-0 z-[99]" @click="closeSettings">
                <div
                    ref="settingsRef"
                    class="absolute right-0 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm shadow-lg overflow-hidden"
                    :style="{ top: headerHeight + 'px', width: '14rem' }"
                    @click.stop
                >
                    <div class="px-3 py-2 space-y-1">
                        <button
                            class="settings-item flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                            @click="toggleLocale(); closeSettings()"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            {{ t('nav.language') }}
                        </button>
                        <button
                            class="settings-item flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                            @click="toggleDark(); closeSettings()"
                        >
                            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}
                        </button>
                        <button
                            class="settings-item flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                            @click="nicknameDialog.open(); closeSettings()"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            {{ t('guest.changeNickname') }}
                        </button>
                        <button
                            v-if="!isGuest"
                            class="settings-item flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                            @click="router.visit(`/profil/${authNickname}`); closeSettings()"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 21v-2a4 4 0 0 0-4-4 4 4 0 0 0-4 4v2"/><circle cx="12" cy="10" r="3"/></svg>
                            {{ t('nav.profile') }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Nickname change dialog -->
        <Dialog
            v-model:visible="nicknameDialog.visible.value"
            :header="t('guest.changeNickname')"
            modal
            :style="{ width: '22rem' }"
        >
            <form @submit.prevent="nicknameDialog.submit" class="space-y-4">
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {{ t('guest.newNickname') }}
                    </label>
                    <InputText
                        :ref="(el) => { nicknameDialog.inputRef.value = el; }"
                        v-model="nicknameDialog.newNickname.value"
                        class="w-full"
                        @keydown.enter.prevent="nicknameDialog.submit"
                    />
                    <small v-if="nicknameDialog.error.value" class="text-red-500">{{ nicknameDialog.error.value }}</small>
                </div>
                <div class="flex justify-end gap-2">
                    <Button :label="t('common.cancel')" severity="secondary" variant="text" @click="nicknameDialog.close" />
                    <Button type="submit" :label="t('common.save')" severity="success" :loading="nicknameDialog.loading.value" />
                </div>
            </form>
        </Dialog>

        <!-- Ban confirmation dialog -->
        <Dialog v-model:visible="banDialogVisible" :header="t('lobby.ban')" modal :style="{ width: '24rem' }">
            <p class="mb-4 text-sm text-slate-700 dark:text-slate-300">{{ t('lobby.banConfirm').replace('{name}', banDialogNickname) }}</p>
            <div class="mb-4">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{{ t('lobby.banReason') }}</label>
                <InputText
                    v-model="banReason"
                    :placeholder="t('lobby.banReason')"
                    class="w-full"
                    maxlength="200"
                />
            </div>
            <div class="flex gap-2 justify-end">
                <Button :label="t('common.cancel')" severity="secondary" variant="outlined" @click="banDialogVisible = false" />
                <Button :label="t('lobby.ban')" severity="danger" :loading="banLoading" @click="confirmBan" />
            </div>
        </Dialog>

        <ConfirmDialog />
        <Toast position="top-center" :pt="{ root: { style: 'top: 3.5rem; left: 50%; transform: translateX(-50%); max-width: calc(100% - 2rem)' }, summary: { style: 'color: white' } }" />
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { Link, router } from '@inertiajs/vue3';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import gsap from 'gsap';
import PlayerAvatar from '../components/PlayerAvatar.vue';
import { useViewport } from '../composables/useViewport.js';
import { useI18n } from '../composables/useI18n.js';
import { useDarkMode } from '../composables/useDarkMode.js';
import { useGameStore } from '../stores/gameStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { useNicknameDialog } from '../composables/useNicknameDialog.js';

const { viewportHeight } = useViewport();
const { t, toggleLocale } = useI18n();
const { isDark, toggleDark } = useDarkMode();
const toast = useToast();
const confirm = useConfirm();
const gameStore = useGameStore();
const authStore = useAuthStore();
const { isGuest, nickname: authNickname } = storeToRefs(authStore);

defineProps({
    gameCode: { type: String, default: '' },
    playerCount: { type: Number, default: 0 },
    maxPlayers: { type: Number, default: 8 },
    leaveLabel: { type: String, default: '' },
    isPrivate: { type: Boolean, default: false },
    players: { type: Array, default: () => [] },
    hostPlayerId: { type: [Number, String], default: null },
});

const emit = defineEmits(['leave', 'nickname-changed']);

const dropdownOpen = ref(false);
const dropdownVisible = ref(false);
const dropdownRef = ref(null);
const headerRef = ref(null);
const headerHeight = ref(0);

function measureHeader() {
    if (headerRef.value) {
        headerHeight.value = headerRef.value.getBoundingClientRect().bottom;
    }
}

onMounted(measureHeader);

function toggleDropdown() {
    if (dropdownOpen.value) {
        closeDropdown();
    } else {
        openDropdown();
    }
}

function openDropdown() {
    dropdownOpen.value = true;
    dropdownVisible.value = true;
    measureHeader();
    nextTick(() => {
        if (!dropdownRef.value) {
            return;
        }
        const rows = dropdownRef.value.querySelectorAll('.player-row');
        gsap.fromTo(
            dropdownRef.value,
            { height: 0, opacity: 0 },
            { height: 'auto', opacity: 1, duration: 0.25, ease: 'power2.out' },
        );
        gsap.fromTo(
            rows,
            { opacity: 0, x: -12 },
            { opacity: 1, x: 0, duration: 0.25, stagger: 0.04, ease: 'power2.out', delay: 0.08 },
        );
    });
}

function closeDropdown() {
    playerActionOpenId.value = null;
    if (!dropdownRef.value) {
        dropdownOpen.value = false;
        dropdownVisible.value = false;
        return;
    }
    const rows = dropdownRef.value.querySelectorAll('.player-row');
    gsap.to(rows, {
        opacity: 0,
        x: -8,
        duration: 0.15,
        stagger: 0.02,
        ease: 'power2.in',
    });
    gsap.to(dropdownRef.value, {
        height: 0,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        delay: 0.05,
        onComplete: () => {
            dropdownOpen.value = false;
            dropdownVisible.value = false;
        },
    });
}

// Settings dropdown
const settingsOpen = ref(false);
const settingsVisible = ref(false);
const settingsRef = ref(null);

function toggleSettings() {
    if (settingsOpen.value) {
        closeSettings();
    } else {
        openSettings();
    }
}

function openSettings() {
    settingsOpen.value = true;
    settingsVisible.value = true;
    measureHeader();
    nextTick(() => {
        if (!settingsRef.value) return;
        const items = settingsRef.value.querySelectorAll('.settings-item');
        gsap.fromTo(
            settingsRef.value,
            { height: 0, opacity: 0 },
            { height: 'auto', opacity: 1, duration: 0.25, ease: 'power2.out' },
        );
        gsap.fromTo(
            items,
            { opacity: 0, x: 8 },
            { opacity: 1, x: 0, duration: 0.25, stagger: 0.04, ease: 'power2.out', delay: 0.08 },
        );
    });
}

function closeSettings() {
    if (!settingsRef.value) {
        settingsOpen.value = false;
        settingsVisible.value = false;
        return;
    }
    const items = settingsRef.value.querySelectorAll('.settings-item');
    gsap.to(items, {
        opacity: 0,
        x: 8,
        duration: 0.15,
        stagger: 0.02,
        ease: 'power2.in',
    });
    gsap.to(settingsRef.value, {
        height: 0,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        delay: 0.05,
        onComplete: () => {
            settingsOpen.value = false;
            settingsVisible.value = false;
        },
    });
}

// Nickname change dialog
const nicknameDialog = useNicknameDialog({
    onSuccess: (player) => {
        const me = gameStore.players.find((p) => p.id === authStore.player.id);
        if (me) me.nickname = player.nickname;
        emit('nickname-changed', player.nickname);
    },
});

// Player management (kick/ban/unban)
const myPlayerId = computed(() => authStore.player?.id);
const canManagePlayers = computed(() => gameStore.isHost);
const playerActionOpenId = ref(null);

function togglePlayerActions(playerId) {
    playerActionOpenId.value = playerActionOpenId.value === playerId ? null : playerId;
}

function canManagePlayer(player) {
    if (!canManagePlayers.value) return false;
    if (player.id === myPlayerId.value) return false;
    // Co-hosts cannot manage other co-hosts, only the actual host can
    if (!gameStore.isActualHost && player.is_co_host) return false;
    // Nobody can manage the actual host
    if (player.id === gameStore.currentGame?.host_player_id) return false;
    return true;
}

function handleKickPlayer(player) {
    playerActionOpenId.value = null;
    confirm.require({
        message: t('lobby.kickConfirm').replace('{name}', player.nickname),
        header: t('lobby.kick'),
        acceptLabel: t('common.confirm'),
        rejectLabel: t('common.cancel'),
        accept: async () => {
            try {
                await gameStore.kickPlayer(gameStore.gameCode, player.id);
            } catch (err) {
                toast.add({ severity: 'error', summary: err.response?.data?.error || t('common.error'), life: 4000 });
            }
        },
    });
}

const banDialogVisible = ref(false);
const banDialogPlayerId = ref(null);
const banDialogNickname = ref('');
const banReason = ref('');
const banLoading = ref(false);

function handleBanPlayer(player) {
    playerActionOpenId.value = null;
    banReason.value = '';
    banDialogPlayerId.value = player.id;
    banDialogNickname.value = player.nickname;
    banDialogVisible.value = true;
}

async function confirmBan() {
    banLoading.value = true;
    try {
        await gameStore.banPlayer(gameStore.gameCode, banDialogPlayerId.value, banReason.value || null);
        banDialogVisible.value = false;
    } catch (err) {
        toast.add({ severity: 'error', summary: err.response?.data?.error || t('common.error'), life: 4000 });
    } finally {
        banLoading.value = false;
    }
}

async function handleUnbanPlayer(playerId) {
    try {
        await gameStore.unbanPlayer(gameStore.gameCode, playerId);
        toast.add({ severity: 'success', summary: t('lobby.unban'), life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: err.response?.data?.error || t('common.error'), life: 4000 });
    }
}

watch(() => gameStore.lastPlayerEvent, (event) => {
    if (!event) {
        return;
    }
    if (event.type === 'joined') {
        toast.add({ severity: 'info', summary: `${event.nickname} ${t('game.playerJoined')}`, life: 3000 });
    } else if (event.type === 'left') {
        toast.add({ severity: 'warn', summary: `${event.nickname} ${t('game.playerLeft')}`, life: 3000 });
    } else if (event.type === 'nickname_changed') {
        toast.add({
            severity: 'info',
            summary: `${event.oldNickname} ${t('game.nicknameChanged')} ${event.newNickname}`,
            life: 4000,
        });
    }
});

watch(() => gameStore.lastSettingsEvent, (event) => {
    if (!event) {
        return;
    }
    const by = event.changedBy;
    for (const change of event.changes) {
        if (change.type === 'chat_enabled') {
            toast.add({ severity: 'info', summary: `${by} ${t('game.chatEnabled')}`, life: 3000 });
        } else if (change.type === 'chat_disabled') {
            toast.add({ severity: 'warn', summary: `${by} ${t('game.chatDisabled')}`, life: 3000 });
        } else if (change.type === 'visibility_public') {
            toast.add({ severity: 'info', summary: `${by} ${t('game.visibilityPublic')}`, life: 3000 });
        } else if (change.type === 'visibility_private') {
            toast.add({ severity: 'warn', summary: `${by} ${t('game.visibilityPrivate')}`, life: 3000 });
        } else if (change.type === 'password_changed') {
            toast.add({ severity: 'info', summary: `${by} ${t('game.passwordChangedTo')} ${change.password}`, life: 8000 });
        }
    }
});
</script>
