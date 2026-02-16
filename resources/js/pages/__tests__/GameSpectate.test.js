import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import GameSpectate from '../GameSpectate.vue';

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({ t: (key) => key, toggleLocale: vi.fn(), locale: { value: 'no' }, isNorwegian: { value: true } }),
}));

vi.mock('../../composables/useGameAnimations.js', () => ({
    useGameAnimations: () => ({
        animatePhaseIn: vi.fn(),
        staggerLetters: vi.fn(),
        staggerCards: vi.fn(),
        staggerRows: vi.fn(),
    }),
}));

vi.mock('../../services/api.js', () => ({
    api: { games: { join: vi.fn() } },
}));

import { router } from '@inertiajs/vue3';
import { api } from '../../services/api.js';
import { useGameStore } from '../../stores/gameStore.js';
import { useAuthStore } from '../../stores/authStore.js';

const stubs = {
    GameLayout: { template: '<div><slot /></div>', props: ['gameCode', 'playerCount', 'maxPlayers', 'players', 'hostPlayerId', 'isPrivate', 'leaveLabel'], emits: ['leave'] },
    Button: { template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>', inheritAttrs: false },
    Badge: { template: '<span>{{ $attrs.value }}</span>', inheritAttrs: false },
    ProgressBar: { template: '<div class="progress-bar" />' },
    Dialog: { template: '<div v-if="$attrs.visible !== false"><slot /></div>', inheritAttrs: false },
    InputText: { template: '<input />', inheritAttrs: false },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
};

function mountSpectate(props = {}) {
    return mount(GameSpectate, {
        props: { code: 'TEST', ...props },
        global: { stubs },
    });
}

function setupStores(overrides = {}) {
    const gameStore = useGameStore();
    const authStore = useAuthStore();

    // Mock store methods
    gameStore.fetchGame = vi.fn().mockResolvedValue({});
    gameStore.connectWebSocket = vi.fn();
    gameStore.disconnectWebSocket = vi.fn();
    gameStore.fetchCurrentRound = vi.fn().mockResolvedValue({});

    // Auth defaults
    authStore.isInitialized = true;
    authStore.loadFromStorage = vi.fn().mockResolvedValue();
    authStore.player = overrides.player !== undefined ? overrides.player : { id: 1, nickname: 'Spectator' };

    // Game defaults
    gameStore.currentGame = overrides.currentGame !== undefined ? overrides.currentGame : {
        code: 'TEST',
        status: 'lobby',
        settings: { max_players: 8, rounds: 5, answer_time: 60, vote_time: 30 },
        host_player_id: 99,
        is_public: true,
    };
    gameStore.players = overrides.players !== undefined ? overrides.players : [
        { id: 99, nickname: 'Host' },
        { id: 2, nickname: 'Player2' },
    ];
    gameStore.phase = overrides.phase !== undefined ? overrides.phase : 'lobby';
    gameStore.acronym = overrides.acronym || '';
    gameStore.currentRound = overrides.currentRound || null;
    gameStore.answers = overrides.answers || [];
    gameStore.roundResults = overrides.roundResults || null;
    gameStore.scores = overrides.scores || [];
    gameStore.timeRemaining = overrides.timeRemaining || 0;
    gameStore.deadline = overrides.deadline || null;

    return { gameStore, authStore };
}

describe('GameSpectate.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -------------------------------------------------------
    // 1. Loading & initialization
    // -------------------------------------------------------

    it('shows loading spinner initially', () => {
        const { gameStore } = setupStores();
        // Make fetchGame hang so loading stays true
        gameStore.fetchGame.mockReturnValue(new Promise(() => {}));

        const wrapper = mountSpectate();

        expect(wrapper.find('.progress-bar').exists()).toBe(true);
    });

    it('calls initSpectate on mount (fetchGame called)', async () => {
        const { gameStore } = setupStores();

        mountSpectate();
        await flushPromises();

        expect(gameStore.fetchGame).toHaveBeenCalledWith('TEST');
    });

    it('shows error state when fetchGame fails', async () => {
        const { gameStore } = setupStores();
        gameStore.fetchGame.mockRejectedValue({
            response: { data: { message: 'Game not found' } },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('Game not found');
        // Should show retry button
        const retryButton = wrapper.findAll('button').find(b => b.text().includes('common.retry'));
        expect(retryButton).toBeTruthy();
    });

    it('shows generic error when fetch fails without message', async () => {
        const { gameStore } = setupStores();
        gameStore.fetchGame.mockRejectedValue(new Error('Network error'));

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('common.error');
    });

    it('redirects to game page if player is already in the game', async () => {
        setupStores({
            player: { id: 99, nickname: 'Host' },
            players: [
                { id: 99, nickname: 'Host' },
                { id: 2, nickname: 'Player2' },
            ],
        });

        mountSpectate();
        await flushPromises();

        expect(router.visit).toHaveBeenCalledWith('/spill/TEST');
    });

    it('connects WebSocket for authenticated users', async () => {
        const { gameStore } = setupStores();

        mountSpectate();
        await flushPromises();

        expect(gameStore.connectWebSocket).toHaveBeenCalledWith('TEST');
    });

    it('loads auth store from storage if not initialized', async () => {
        const { authStore } = setupStores();
        authStore.isInitialized = false;

        mountSpectate();
        await flushPromises();

        expect(authStore.loadFromStorage).toHaveBeenCalled();
    });

    it('fetches current round when phase is playing', async () => {
        const { gameStore } = setupStores({ phase: 'playing' });

        mountSpectate();
        await flushPromises();

        expect(gameStore.fetchCurrentRound).toHaveBeenCalledWith('TEST');
    });

    it('fetches current round when phase is voting', async () => {
        const { gameStore } = setupStores({ phase: 'voting' });

        mountSpectate();
        await flushPromises();

        expect(gameStore.fetchCurrentRound).toHaveBeenCalledWith('TEST');
    });

    // -------------------------------------------------------
    // 2. Join bar
    // -------------------------------------------------------

    it('shows join bar when phase is active (not finished)', async () => {
        setupStores({ phase: 'lobby' });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('spectate.watching');
    });

    it('does not show join bar when phase is finished', async () => {
        setupStores({ phase: 'finished' });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).not.toContain('spectate.watching');
    });

    it('shows login button for unauthenticated users', async () => {
        setupStores({ player: null });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('nav.login');
    });

    it('shows game full button when at max players', async () => {
        setupStores({
            players: Array.from({ length: 8 }, (_, i) => ({ id: i + 10, nickname: `Player${i}` })),
            currentGame: {
                code: 'TEST',
                status: 'lobby',
                settings: { max_players: 8, rounds: 5, answer_time: 60, vote_time: 30 },
                host_player_id: 10,
                is_public: true,
            },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('spectate.gameFull');
    });

    it('shows join button when user can join', async () => {
        setupStores();

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('spectate.join');
    });

    it('join redirects on success', async () => {
        setupStores();
        api.games.join.mockResolvedValue({});

        const wrapper = mountSpectate();
        await flushPromises();

        // Click the join button
        const joinButton = wrapper.findAll('button').find(b => b.text().includes('spectate.join'));
        expect(joinButton).toBeTruthy();

        await joinButton.trigger('click');
        await flushPromises();

        expect(api.games.join).toHaveBeenCalledWith('TEST', undefined);
        expect(router.visit).toHaveBeenCalledWith('/spill/TEST');
    });

    it('shows password dialog for password-protected games', async () => {
        setupStores({
            currentGame: {
                code: 'TEST',
                status: 'lobby',
                settings: { max_players: 8, rounds: 5, answer_time: 60, vote_time: 30 },
                host_player_id: 99,
                is_public: false,
                has_password: true,
            },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        // Click the join button
        const joinButton = wrapper.findAll('button').find(b => b.text().includes('spectate.join'));
        await joinButton.trigger('click');
        await flushPromises();

        // Password dialog should be shown (header is an attr, content is text)
        expect(wrapper.text()).toContain('lobby.enterPassword');
        expect(wrapper.text()).toContain('common.cancel');
        expect(wrapper.text()).toContain('games.join');
    });

    it('shows join error message on failure', async () => {
        setupStores();
        api.games.join.mockRejectedValue({
            response: { data: { error: 'Game is full' } },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        const joinButton = wrapper.findAll('button').find(b => b.text().includes('spectate.join'));
        await joinButton.trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('Game is full');
    });

    it('redirects when join fails with "already in game" message', async () => {
        setupStores();
        api.games.join.mockRejectedValue({
            response: { data: { error: 'Already in game' } },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        const joinButton = wrapper.findAll('button').find(b => b.text().includes('spectate.join'));
        await joinButton.trigger('click');
        await flushPromises();

        expect(router.visit).toHaveBeenCalledWith('/spill/TEST');
    });

    // -------------------------------------------------------
    // 3. Lobby phase
    // -------------------------------------------------------

    it('shows lobby title and player list', async () => {
        setupStores({ phase: 'lobby' });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('lobby.title');
        expect(wrapper.text()).toContain('Host');
        expect(wrapper.text()).toContain('Player2');
    });

    it('shows waiting for host message', async () => {
        setupStores({ phase: 'lobby' });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('lobby.waitingForHost');
    });

    it('shows host badge on host player', async () => {
        setupStores({ phase: 'lobby' });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('lobby.host');
    });

    // -------------------------------------------------------
    // 4. Playing phase
    // -------------------------------------------------------

    it('shows acronym letters during playing phase', async () => {
        setupStores({
            phase: 'playing',
            acronym: 'ABC',
        });

        const wrapper = mountSpectate();
        await flushPromises();

        const letters = wrapper.findAll('.acronym-letter');
        expect(letters).toHaveLength(3);
        expect(letters[0].text()).toBe('A');
        expect(letters[1].text()).toBe('B');
        expect(letters[2].text()).toBe('C');
    });

    it('shows submission counter during playing phase', async () => {
        setupStores({
            phase: 'playing',
            acronym: 'AB',
            currentRound: { round_number: 1, answers_count: 2, total_players: 4 },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('2/4');
        expect(wrapper.text()).toContain('game.submitted');
    });

    // -------------------------------------------------------
    // 5. Voting phase
    // -------------------------------------------------------

    it('shows voting title', async () => {
        setupStores({
            phase: 'voting',
            acronym: 'AB',
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.voting');
    });

    it('shows answer cards during voting', async () => {
        setupStores({
            phase: 'voting',
            acronym: 'AB',
            answers: [
                { id: 1, text: 'Amazing Bananas' },
                { id: 2, text: 'Awesome Birds' },
            ],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        const cards = wrapper.findAll('.vote-card');
        expect(cards).toHaveLength(2);
        expect(cards[0].text()).toContain('amazing bananas');
        expect(cards[1].text()).toContain('awesome birds');
    });

    it('shows vote counter during voting phase', async () => {
        setupStores({
            phase: 'voting',
            acronym: 'AB',
            currentRound: { votes_count: 3, total_voters: 5 },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('3/5');
        expect(wrapper.text()).toContain('game.votes');
    });

    // -------------------------------------------------------
    // 6. Results phase
    // -------------------------------------------------------

    it('shows results title', async () => {
        setupStores({
            phase: 'results',
            roundResults: [],
            scores: [],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.results');
    });

    it('shows round results', async () => {
        setupStores({
            phase: 'results',
            roundResults: [
                { answer_id: 1, text: 'Great Answer', player_nickname: 'Player1', votes_count: 3 },
                { answer_id: 2, text: 'Okay Answer', player_nickname: 'Player2', votes_count: 1 },
            ],
            scores: [],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        const resultCards = wrapper.findAll('.result-card');
        expect(resultCards).toHaveLength(2);
        expect(wrapper.text()).toContain('great answer');
        expect(wrapper.text()).toContain('Player1');
    });

    it('shows scoreboard in results phase', async () => {
        setupStores({
            phase: 'results',
            roundResults: [],
            scores: [
                { player_id: 1, nickname: 'TopPlayer', score: 10 },
                { player_id: 2, nickname: 'SecondPlayer', score: 5 },
            ],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.scoreboard');
        expect(wrapper.text()).toContain('TopPlayer');
        expect(wrapper.text()).toContain('10');
        expect(wrapper.text()).toContain('SecondPlayer');
        expect(wrapper.text()).toContain('5');
    });

    // -------------------------------------------------------
    // 7. Finished phase
    // -------------------------------------------------------

    it('shows game finished text', async () => {
        setupStores({
            phase: 'finished',
            scores: [],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.finished');
    });

    it('shows winner when present', async () => {
        setupStores({
            phase: 'finished',
            currentGame: {
                code: 'TEST',
                status: 'finished',
                settings: { max_players: 8, rounds: 5, answer_time: 60, vote_time: 30 },
                host_player_id: 99,
                is_public: true,
                winner: { nickname: 'ChampionPlayer' },
            },
            scores: [],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.winner');
        expect(wrapper.text()).toContain('ChampionPlayer');
    });

    it('shows final scores in finished phase', async () => {
        setupStores({
            phase: 'finished',
            scores: [
                { player_id: 1, nickname: 'Winner', score: 25 },
                { player_id: 2, nickname: 'RunnerUp', score: 15 },
            ],
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.finalScores');
        expect(wrapper.text()).toContain('Winner');
        expect(wrapper.text()).toContain('25');
        expect(wrapper.text()).toContain('RunnerUp');
        expect(wrapper.text()).toContain('15');
    });

    it('shows archive button in finished phase', async () => {
        setupStores({ phase: 'finished', scores: [] });

        const wrapper = mountSpectate();
        await flushPromises();

        const archiveButton = wrapper.findAll('button').find(b => b.text().includes('game.viewArchive'));
        expect(archiveButton).toBeTruthy();

        await archiveButton.trigger('click');

        expect(router.visit).toHaveBeenCalledWith('/arkiv/TEST');
    });

    // -------------------------------------------------------
    // 8. Timer
    // -------------------------------------------------------

    it('shows timer bar during playing phase', async () => {
        setupStores({
            phase: 'playing',
            acronym: 'AB',
            currentRound: { round_number: 2 },
            deadline: new Date(Date.now() + 30000),
            timeRemaining: 30,
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('game.round');
        expect(wrapper.text()).toContain('game.of');
        expect(wrapper.text()).toContain('30s');
    });

    it('shows timer bar during voting phase', async () => {
        setupStores({
            phase: 'voting',
            acronym: 'AB',
            currentRound: { round_number: 1 },
            deadline: new Date(Date.now() + 15000),
            timeRemaining: 15,
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('15s');
    });

    it('does not show timer bar during lobby phase', async () => {
        setupStores({ phase: 'lobby' });

        const wrapper = mountSpectate();
        await flushPromises();

        // Timer is only shown for playing/voting; lobby should not have time display
        const timerText = wrapper.findAll('span').filter(s => s.text().match(/\d+s$/));
        expect(timerText).toHaveLength(0);
    });

    // -------------------------------------------------------
    // 9. Polling for unauthenticated users
    // -------------------------------------------------------

    it('starts polling for unauthenticated users instead of WebSocket', async () => {
        const { gameStore } = setupStores({ player: null });

        mountSpectate();
        await flushPromises();

        // Should not connect WebSocket
        expect(gameStore.connectWebSocket).not.toHaveBeenCalled();

        // Should poll after interval
        expect(gameStore.fetchGame).toHaveBeenCalledTimes(1); // initial call

        vi.advanceTimersByTime(5000);
        await flushPromises();

        expect(gameStore.fetchGame).toHaveBeenCalledTimes(2); // poll call
    });

    it('disconnects WebSocket and stops polling on unmount', async () => {
        const { gameStore } = setupStores();

        const wrapper = mountSpectate();
        await flushPromises();

        wrapper.unmount();

        expect(gameStore.disconnectWebSocket).toHaveBeenCalled();
    });

    it('stops polling on unmount for unauthenticated users', async () => {
        const { gameStore } = setupStores({ player: null });

        const wrapper = mountSpectate();
        await flushPromises();

        // First poll call (initial)
        expect(gameStore.fetchGame).toHaveBeenCalledTimes(1);

        wrapper.unmount();

        // Advance past poll interval - should NOT trigger another fetch
        vi.advanceTimersByTime(10000);
        await flushPromises();

        // Still only 1 call (no polling after unmount)
        expect(gameStore.fetchGame).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------
    // 10. Retry button
    // -------------------------------------------------------

    it('retry button re-calls initSpectate', async () => {
        const { gameStore } = setupStores();
        gameStore.fetchGame.mockRejectedValueOnce({
            response: { data: { message: 'Server error' } },
        });

        const wrapper = mountSpectate();
        await flushPromises();

        expect(wrapper.text()).toContain('Server error');

        // Now make fetchGame succeed
        gameStore.fetchGame.mockResolvedValue({});

        const retryButton = wrapper.findAll('button').find(b => b.text().includes('common.retry'));
        await retryButton.trigger('click');
        await flushPromises();

        expect(gameStore.fetchGame).toHaveBeenCalledTimes(2);
    });
});
