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
                                class="player-row flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                            >
                                <PlayerAvatar :nickname="player.nickname" :avatar-url="player.avatar_url" size="xs" />
                                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ player.nickname }}</span>
                                <Badge v-if="player.id === hostPlayerId" :value="t('lobby.host')" severity="success" class="ml-auto" />
                            </div>
                        </div>
                        <p v-if="players.length === 0" class="text-xs text-slate-400 py-1">
                            {{ t('lobby.noPlayers') }}
                        </p>
                    </div>
                </div>
            </div>
        </Teleport>

        <Toast position="top-center" :pt="{ root: { style: 'top: 3.5rem; left: 50%; transform: translateX(-50%); max-width: calc(100% - 2rem)' }, summary: { style: 'color: white' } }" />
    </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { Link } from '@inertiajs/vue3';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Toast from 'primevue/toast';
import gsap from 'gsap';
import PlayerAvatar from '../components/PlayerAvatar.vue';
import { useViewport } from '../composables/useViewport.js';
import { useI18n } from '../composables/useI18n.js';
import { useGameStore } from '../stores/gameStore.js';

const { viewportHeight } = useViewport();
const { t } = useI18n();
const toast = useToast();
const gameStore = useGameStore();

defineProps({
    gameCode: { type: String, default: '' },
    playerCount: { type: Number, default: 0 },
    maxPlayers: { type: Number, default: 8 },
    leaveLabel: { type: String, default: '' },
    isPrivate: { type: Boolean, default: false },
    players: { type: Array, default: () => [] },
    hostPlayerId: { type: [Number, String], default: null },
});

defineEmits(['leave']);

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
