import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, reactive } from 'vue';
import GameLayout from '../GameLayout.vue';

const mockKickPlayer = vi.fn();
const mockBanPlayer = vi.fn();
const mockUnbanPlayer = vi.fn();

const mockGameStore = reactive({
    currentGame: null,
    lastPlayerEvent: null,
    lastSettingsEvent: null,
    players: [],
    isHost: false,
    isActualHost: false,
    gameCode: 'ABCD',
    kickPlayer: mockKickPlayer,
    banPlayer: mockBanPlayer,
    unbanPlayer: mockUnbanPlayer,
});

vi.mock('../../stores/gameStore.js', () => ({
    useGameStore: () => mockGameStore,
}));

vi.mock('gsap', () => ({
    default: { fromTo: vi.fn(), to: vi.fn() },
}));

vi.mock('../../composables/useViewport.js', () => ({
    useViewport: () => ({ viewportHeight: ref(800) }),
}));

const mockToastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: mockToastAdd }),
}));

const mockConfirmRequire = vi.fn();
vi.mock('primevue/useconfirm', () => ({
    useConfirm: () => ({ require: mockConfirmRequire }),
}));

const mockToggleLocale = vi.fn();
vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: mockToggleLocale,
        locale: { value: 'no' },
        isNorwegian: { value: true },
    }),
}));

const mockToggleDark = vi.fn();
const mockIsDark = ref(false);
vi.mock('../../composables/useDarkMode.js', () => ({
    useDarkMode: () => ({
        isDark: mockIsDark,
        toggleDark: mockToggleDark,
    }),
}));

const mockIsGuest = ref(true);
const mockAuthStore = reactive({
    player: { id: 1, nickname: 'Guest123', is_guest: true },
    isGuest: mockIsGuest,
    nickname: 'Guest123',
});
vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => mockAuthStore,
}));

vi.mock('../../services/api.js', () => ({
    api: {
        profile: {
            updateNickname: vi.fn(),
        },
    },
}));

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    Badge: { template: '<span class="badge">{{ $attrs.value }}</span>', inheritAttrs: false },
    Toast: { template: '<div class="toast" />' },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    Teleport: { template: '<div><slot /></div>' },
    InputText: { template: '<input />', inheritAttrs: false },
    Dialog: { template: '<div v-if="$attrs.visible" class="dialog"><slot /></div>', inheritAttrs: false },
    ConfirmDialog: { template: '<div />' },
};

function mountGameLayout(props = {}) {
    return mount(GameLayout, {
        props: {
            gameCode: 'ABCD',
            playerCount: 3,
            maxPlayers: 8,
            isPrivate: false,
            players: [],
            hostPlayerId: null,
            ...props,
        },
        global: { stubs },
    });
}

describe('GameLayout.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockGameStore.currentGame = null;
        mockGameStore.lastPlayerEvent = null;
        mockGameStore.lastSettingsEvent = null;
        mockGameStore.players = [];
        mockGameStore.isHost = false;
        mockGameStore.isActualHost = false;
        mockGameStore.gameCode = 'ABCD';
        mockAuthStore.player = { id: 1, nickname: 'Guest123', is_guest: true };
        mockIsGuest.value = true;
        mockAuthStore.nickname = 'Guest123';
        mockIsDark.value = false;
    });

    it('renders game code in header', () => {
        const wrapper = mountGameLayout({ gameCode: 'XY42' });

        expect(wrapper.text()).toContain('#XY42');
    });

    it('shows lock icon when isPrivate is true', () => {
        const wrapper = mountGameLayout({ isPrivate: true });

        // The lock icon is an SVG with the amber color class inside the game code span
        const headerSpan = wrapper.find('.font-mono.font-bold');
        const lockSvg = headerSpan.find('svg');
        expect(lockSvg.exists()).toBe(true);
        expect(lockSvg.classes()).toContain('text-amber-500');
    });

    it('does not show lock icon when isPrivate is false', () => {
        const wrapper = mountGameLayout({ isPrivate: false });

        // The lock icon has a specific path for the padlock, check the header span
        const headerSpan = wrapper.find('.font-mono.font-bold');
        const svgsInSpan = headerSpan.findAll('svg');
        expect(svgsInSpan.length).toBe(0);
    });

    it('shows password_text when currentGame has it', async () => {
        mockGameStore.currentGame = { password_text: 'secret123' };

        const wrapper = mountGameLayout();
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain('secret123');
    });

    it('does not show password_text when currentGame is null', () => {
        mockGameStore.currentGame = null;

        const wrapper = mountGameLayout();

        expect(wrapper.text()).not.toContain('password_text');
    });

    it('shows player count with correct numbers', () => {
        const wrapper = mountGameLayout({ playerCount: 3, maxPlayers: 8 });

        expect(wrapper.text()).toContain('3/8');
    });

    it('leave button emits leave event', async () => {
        const wrapper = mountGameLayout();

        const leaveButton = wrapper.findAll('button').find((btn) => btn.text().includes('game.leave'));
        expect(leaveButton).toBeTruthy();
        await leaveButton.trigger('click');

        expect(wrapper.emitted('leave')).toBeTruthy();
        expect(wrapper.emitted('leave').length).toBe(1);
    });

    it('uses custom leaveLabel when provided', () => {
        const wrapper = mountGameLayout({ leaveLabel: 'Go Away' });

        const leaveButton = wrapper.findAll('button').find((btn) => btn.text().includes('Go Away'));
        expect(leaveButton).toBeTruthy();
    });

    it('dropdown toggles on player count button click', async () => {
        const wrapper = mountGameLayout({
            players: [{ id: 1, nickname: 'Alice', avatar_url: null }],
        });

        // Dropdown should not be visible initially
        expect(wrapper.text()).not.toContain('common.player');

        // Click the player count button to open
        const playerCountBtn = wrapper.findAll('button').find((btn) => btn.text().includes('3/8'));
        await playerCountBtn.trigger('click');

        // Dropdown should now be visible
        expect(wrapper.text()).toContain('common.player');
    });

    it('shows player list in dropdown', async () => {
        const players = [
            { id: 1, nickname: 'Alice', avatar_url: null },
            { id: 2, nickname: 'Bob', avatar_url: null },
            { id: 3, nickname: 'Charlie', avatar_url: null },
        ];

        const wrapper = mountGameLayout({ players, playerCount: 3 });

        // Open dropdown
        const playerCountBtn = wrapper.findAll('button').find((btn) => btn.text().includes('3/8'));
        await playerCountBtn.trigger('click');

        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');
        expect(wrapper.text()).toContain('Charlie');
    });

    it('shows host badge for host player', async () => {
        const players = [
            { id: 1, nickname: 'Alice', avatar_url: null },
            { id: 2, nickname: 'Bob', avatar_url: null },
        ];

        const wrapper = mountGameLayout({ players, hostPlayerId: 1, playerCount: 2 });

        // Open dropdown
        const playerCountBtn = wrapper.findAll('button').find((btn) => btn.text().includes('2/8'));
        await playerCountBtn.trigger('click');

        // The badge should show the host label for player 1
        const badges = wrapper.findAll('.badge');
        expect(badges.length).toBe(1);
        expect(badges[0].text()).toBe('lobby.host');
    });

    it('does not show host badge for non-host player', async () => {
        const players = [
            { id: 1, nickname: 'Alice', avatar_url: null },
            { id: 2, nickname: 'Bob', avatar_url: null },
        ];

        const wrapper = mountGameLayout({ players, hostPlayerId: 99, playerCount: 2 });

        // Open dropdown
        const playerCountBtn = wrapper.findAll('button').find((btn) => btn.text().includes('2/8'));
        await playerCountBtn.trigger('click');

        const badges = wrapper.findAll('.badge');
        expect(badges.length).toBe(0);
    });

    it('shows noPlayers message when players array is empty', async () => {
        const wrapper = mountGameLayout({ players: [], playerCount: 0, maxPlayers: 8 });

        // Open dropdown
        const playerCountBtn = wrapper.findAll('button').find((btn) => btn.text().includes('0/8'));
        await playerCountBtn.trigger('click');

        expect(wrapper.text()).toContain('lobby.noPlayers');
    });

    it('renders slot content in main', () => {
        const wrapper = mount(GameLayout, {
            props: {
                gameCode: 'ABCD',
                playerCount: 1,
                maxPlayers: 8,
                players: [],
            },
            slots: {
                default: '<p class="slot-content">Game Content Here</p>',
            },
            global: { stubs },
        });

        expect(wrapper.find('.slot-content').exists()).toBe(true);
        expect(wrapper.text()).toContain('Game Content Here');
    });

    describe('settings cog', () => {
        it('renders the settings cog button', () => {
            const wrapper = mountGameLayout();

            const cogBtn = wrapper.find('.settings-cog');
            expect(cogBtn.exists()).toBe(true);
        });

        it('toggles settings dropdown on cog click', async () => {
            const wrapper = mountGameLayout();

            // Settings dropdown should not be visible initially
            expect(wrapper.findAll('.settings-item').length).toBe(0);

            // Click the cog button to open
            const cogBtn = wrapper.find('.settings-cog');
            await cogBtn.trigger('click');

            // Settings dropdown should now be visible with language and dark mode buttons
            const items = wrapper.findAll('.settings-item');
            expect(items.length).toBeGreaterThanOrEqual(2);
        });

        it('shows language and dark mode buttons in settings dropdown', async () => {
            const wrapper = mountGameLayout();

            const cogBtn = wrapper.find('.settings-cog');
            await cogBtn.trigger('click');

            const text = wrapper.text();
            expect(text).toContain('nav.language');
            expect(text).toContain('nav.darkMode');
        });

        it('shows nickname change button for all users', async () => {
            const wrapper = mountGameLayout();

            const cogBtn = wrapper.find('.settings-cog');
            await cogBtn.trigger('click');

            expect(wrapper.text()).toContain('guest.changeNickname');
        });

        it('shows profile button for registered users', async () => {
            mockIsGuest.value = false;

            const wrapper = mountGameLayout();

            const cogBtn = wrapper.find('.settings-cog');
            await cogBtn.trigger('click');

            expect(wrapper.text()).toContain('nav.profile');
        });

        it('does not show profile button for guests', async () => {
            mockIsGuest.value = true;

            const wrapper = mountGameLayout();

            const cogBtn = wrapper.find('.settings-cog');
            await cogBtn.trigger('click');

            expect(wrapper.text()).not.toContain('nav.profile');
        });

        it('shows light mode text when dark mode is active', async () => {
            mockIsDark.value = true;

            const wrapper = mountGameLayout();

            const cogBtn = wrapper.find('.settings-cog');
            await cogBtn.trigger('click');

            expect(wrapper.text()).toContain('nav.lightMode');
        });
    });

    describe('player management (kick/ban)', () => {
        const players = [
            { id: 1, nickname: 'HostPlayer', avatar_url: null },
            { id: 2, nickname: 'OtherPlayer', avatar_url: null },
            { id: 3, nickname: 'ThirdPlayer', avatar_url: null },
        ];

        function openDropdown(wrapper) {
            const playerCountBtn = wrapper.findAll('button').find((btn) => btn.text().includes('/8'));
            return playerCountBtn.trigger('click');
        }

        it('shows action cog for other players when user is host', async () => {
            mockAuthStore.player = { id: 1, nickname: 'HostPlayer' };
            mockGameStore.isHost = true;
            mockGameStore.isActualHost = true;
            mockGameStore.currentGame = { host_player_id: 1 };

            const wrapper = mountGameLayout({ players, playerCount: 3, hostPlayerId: 1 });
            await openDropdown(wrapper);

            const cogs = wrapper.findAll('.player-action-cog');
            // Should show cog for players 2 and 3, but not player 1 (self/host)
            expect(cogs.length).toBe(2);
        });

        it('does not show action cog when user is not host', async () => {
            mockAuthStore.player = { id: 2, nickname: 'OtherPlayer' };
            mockGameStore.isHost = false;
            mockGameStore.isActualHost = false;
            mockGameStore.currentGame = { host_player_id: 1 };

            const wrapper = mountGameLayout({ players, playerCount: 3, hostPlayerId: 1 });
            await openDropdown(wrapper);

            const cogs = wrapper.findAll('.player-action-cog');
            expect(cogs.length).toBe(0);
        });

        it('shows kick and ban options when action cog is clicked', async () => {
            mockAuthStore.player = { id: 1, nickname: 'HostPlayer' };
            mockGameStore.isHost = true;
            mockGameStore.isActualHost = true;
            mockGameStore.currentGame = { host_player_id: 1 };

            const wrapper = mountGameLayout({ players, playerCount: 3, hostPlayerId: 1 });
            await openDropdown(wrapper);

            const cog = wrapper.find('.player-action-cog');
            await cog.trigger('click');

            expect(wrapper.text()).toContain('lobby.kick');
            expect(wrapper.text()).toContain('lobby.ban');
        });

        it('calls confirm.require when kick is clicked', async () => {
            mockAuthStore.player = { id: 1, nickname: 'HostPlayer' };
            mockGameStore.isHost = true;
            mockGameStore.isActualHost = true;
            mockGameStore.currentGame = { host_player_id: 1 };

            const wrapper = mountGameLayout({ players, playerCount: 3, hostPlayerId: 1 });
            await openDropdown(wrapper);

            const cog = wrapper.find('.player-action-cog');
            await cog.trigger('click');

            const kickBtn = wrapper.findAll('button').find((btn) => btn.text().includes('lobby.kick'));
            await kickBtn.trigger('click');

            expect(mockConfirmRequire).toHaveBeenCalledTimes(1);
        });

        it('shows banned players section when there are banned players', async () => {
            mockAuthStore.player = { id: 1, nickname: 'HostPlayer' };
            mockGameStore.isHost = true;
            mockGameStore.currentGame = {
                host_player_id: 1,
                banned_players: [{ id: 99, nickname: 'BadPlayer', ban_reason: 'Cheating' }],
            };

            const wrapper = mountGameLayout({ players, playerCount: 3, hostPlayerId: 1 });
            await openDropdown(wrapper);

            expect(wrapper.text()).toContain('lobby.bannedPlayers');
            expect(wrapper.text()).toContain('BadPlayer');
            expect(wrapper.text()).toContain('Cheating');
            expect(wrapper.text()).toContain('lobby.unban');
        });

        it('does not show banned players section for non-hosts', async () => {
            mockAuthStore.player = { id: 2, nickname: 'OtherPlayer' };
            mockGameStore.isHost = false;
            mockGameStore.currentGame = {
                host_player_id: 1,
                banned_players: [{ id: 99, nickname: 'BadPlayer', ban_reason: null }],
            };

            const wrapper = mountGameLayout({ players, playerCount: 3, hostPlayerId: 1 });
            await openDropdown(wrapper);

            expect(wrapper.text()).not.toContain('lobby.bannedPlayers');
        });
    });
});
