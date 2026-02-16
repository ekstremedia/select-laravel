import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, reactive } from 'vue';
import GameLayout from '../GameLayout.vue';

const mockCurrentGame = ref(null);
const mockLastPlayerEvent = ref(null);
const mockLastSettingsEvent = ref(null);

const mockGameStore = reactive({
    currentGame: null,
    lastPlayerEvent: null,
    lastSettingsEvent: null,
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

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: vi.fn(),
        locale: { value: 'no' },
        isNorwegian: { value: true },
    }),
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
});
