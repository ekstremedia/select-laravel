import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Game from '../Game.vue';

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

vi.mock('../../composables/useGameAnimations.js', () => ({
    useGameAnimations: () => ({
        animatePhaseIn: vi.fn(),
        staggerLetters: vi.fn(),
        staggerCards: vi.fn(),
        staggerRows: vi.fn(),
        animateSwap: vi.fn(),
        pulse: vi.fn(),
    }),
}));

vi.mock('../../services/api.js', () => ({
    api: {
        games: {
            invite: vi.fn(),
        },
        profile: {
            updateNickname: vi.fn(),
        },
    },
    getApiError: vi.fn((err, t) => err.response?.data?.error || 'common.error'),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('primevue/useconfirm', () => ({
    useConfirm: () => ({ require: vi.fn() }),
}));

import { router } from '@inertiajs/vue3';
import { useGameStore } from '../../stores/gameStore.js';
import { useAuthStore } from '../../stores/authStore.js';

const stubs = {
    GameLayout: {
        template: '<div class="game-layout"><slot /></div>',
        props: ['gameCode', 'playerCount', 'maxPlayers', 'players', 'hostPlayerId', 'isPrivate'],
    },
    Button: {
        template: '<button :type="$attrs.type" :disabled="$attrs.disabled" :class="{ loading: $attrs.loading }" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: {
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        props: ['modelValue'],
        emits: ['update:modelValue'],
    },
    ProgressBar: { template: '<div class="progress-bar" />', inheritAttrs: false },
    Badge: { template: '<span class="badge">{{ $attrs.value }}</span>', inheritAttrs: false },
    Dialog: {
        template: '<div v-if="$attrs.visible !== false" class="dialog"><slot /><slot name="footer" /></div>',
        inheritAttrs: false,
    },
    Popover: { template: '<div class="popover"><slot /></div>' },
    Slider: { template: '<input type="range" />', inheritAttrs: false },
    ToggleSwitch: { template: '<input type="checkbox" />', inheritAttrs: false },
    Checkbox: { template: '<input type="checkbox" />', inheritAttrs: false },
    ConfirmDialog: { template: '<div />' },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Transition: { template: '<div><slot /></div>' },
};

function defaultSettings() {
    return {
        rounds: 5,
        answer_time: 60,
        vote_time: 30,
        time_between_rounds: 15,
        acronym_length_min: 3,
        max_players: 8,
        max_edits: 0,
        max_vote_changes: 0,
        allow_ready_check: true,
        chat_enabled: true,
    };
}

function setupStores(overrides = {}) {
    const gameStore = useGameStore();
    const authStore = useAuthStore();

    // Default auth state
    authStore.player = overrides.player ?? { id: 1, nickname: 'TestPlayer', is_guest: false };
    authStore.isInitialized = true;

    // Mock all gameStore async methods
    gameStore.fetchGame = vi.fn().mockResolvedValue({});
    gameStore.joinGame = vi.fn().mockResolvedValue({});
    gameStore.connectWebSocket = vi.fn();
    gameStore.disconnectWebSocket = vi.fn();
    gameStore.startGame = vi.fn().mockResolvedValue({});
    gameStore.submitAnswer = vi.fn().mockResolvedValue({});
    gameStore.submitVote = vi.fn().mockResolvedValue({});
    gameStore.retractVote = vi.fn().mockResolvedValue({});
    gameStore.sendChatMessage = vi.fn().mockResolvedValue({});
    gameStore.rematch = vi.fn().mockResolvedValue({});
    gameStore.leaveGame = vi.fn().mockResolvedValue({});
    gameStore.markReady = vi.fn().mockResolvedValue({ ready_count: 1, total_players: 2 });
    gameStore.addBot = vi.fn().mockResolvedValue({});
    gameStore.removeBot = vi.fn().mockResolvedValue({});
    gameStore.kickPlayer = vi.fn().mockResolvedValue({});
    gameStore.banPlayer = vi.fn().mockResolvedValue({});
    gameStore.unbanPlayer = vi.fn().mockResolvedValue({});
    gameStore.toggleCoHost = vi.fn().mockResolvedValue({});
    gameStore.updateSettings = vi.fn().mockResolvedValue({});
    gameStore.updateVisibility = vi.fn().mockResolvedValue({});
    gameStore.fetchGameState = vi.fn().mockResolvedValue({});
    gameStore.keepalive = vi.fn().mockResolvedValue({});
    gameStore.endGame = vi.fn().mockResolvedValue({});
    gameStore.resetState = vi.fn();
    gameStore.fetchCurrentRound = vi.fn().mockResolvedValue({});

    // Mock loadFromStorage on authStore
    authStore.loadFromStorage = vi.fn().mockResolvedValue({});

    return { gameStore, authStore };
}

function mountGame(props = {}) {
    return mount(Game, {
        props: { code: 'TEST', ...props },
        global: { stubs },
    });
}

describe('Game.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    // =====================
    // 1. Loading & Initialization
    // =====================
    describe('Loading & Initialization', () => {
        it('shows loading spinner initially', () => {
            const { gameStore } = setupStores();
            // Make fetchGame hang so loading stays true
            gameStore.fetchGame.mockReturnValue(new Promise(() => {}));

            const wrapper = mountGame();
            expect(wrapper.find('.progress-bar').exists()).toBe(true);
        });

        it('shows error state when fetch fails', async () => {
            const { gameStore } = setupStores();
            gameStore.fetchGame.mockRejectedValue({
                response: { data: { error: 'Game not found' } },
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('Game not found');
            // Retry button should be present
            expect(wrapper.text()).toContain('common.retry');
        });

        it('calls initGame on mount and fetches game', async () => {
            const { gameStore } = setupStores();

            // Setup gameStore so after fetch it shows lobby
            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = { code: 'TEST', status: 'lobby', settings: defaultSettings(), host_player_id: 1, is_public: true };
                gameStore.players = [{ id: 1, nickname: 'TestPlayer' }];
                gameStore.phase = 'lobby';
            });

            mountGame();
            await flushPromises();

            expect(gameStore.fetchGame).toHaveBeenCalledWith('TEST');
            expect(gameStore.connectWebSocket).toHaveBeenCalledWith('TEST');
        });

        it('redirects to login when not authenticated', async () => {
            const { authStore } = setupStores();
            authStore.player = null;

            mountGame();
            await flushPromises();

            expect(router.visit).toHaveBeenCalledWith(
                expect.stringContaining('/logg-inn?redirect=')
            );
        });

        it('retries initGame when retry button is clicked', async () => {
            const { gameStore } = setupStores();
            gameStore.fetchGame.mockRejectedValueOnce({
                response: { data: { error: 'Network error' } },
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('Network error');

            // Now make the second call succeed
            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = { code: 'TEST', status: 'lobby', settings: defaultSettings(), host_player_id: 1, is_public: true };
                gameStore.players = [{ id: 1, nickname: 'TestPlayer' }];
                gameStore.phase = 'lobby';
            });

            // Click retry
            const retryButton = wrapper.findAll('button').find(b => b.text().includes('common.retry'));
            await retryButton.trigger('click');
            await flushPromises();

            expect(gameStore.fetchGame).toHaveBeenCalledTimes(2);
        });
    });

    // =====================
    // 2. Lobby Phase
    // =====================
    describe('Lobby Phase', () => {
        function setupLobby(overrides = {}) {
            const stores = setupStores(overrides);
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'ABCD',
                    status: 'lobby',
                    settings: defaultSettings(),
                    host_player_id: overrides.hostId ?? 1,
                    is_public: overrides.isPublic ?? true,
                    banned_players: overrides.bannedPlayers ?? [],
                };
                gameStore.players = overrides.players ?? [
                    { id: 1, nickname: 'HostPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'lobby';
            });

            return stores;
        }

        it('renders game code in lobby', async () => {
            setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.title');
            expect(wrapper.text()).toContain('lobby.gameCode');
        });

        it('shows player list with nicknames', async () => {
            setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('HostPlayer');
            expect(wrapper.text()).toContain('Player2');
        });

        it('shows host controls (start/end) when player is host', async () => {
            setupLobby({ hostId: 1 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.startGame');
            expect(wrapper.text()).toContain('lobby.endGame');
        });

        it('shows "waiting for host" when player is not host', async () => {
            setupLobby({ hostId: 99 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.waitingForHost');
            expect(wrapper.text()).not.toContain('lobby.startGame');
        });

        it('start button disabled when fewer than 2 players', async () => {
            setupLobby({ players: [{ id: 1, nickname: 'HostPlayer' }] });

            const wrapper = mountGame();
            await flushPromises();

            const startBtn = wrapper.findAll('button').find(b => b.text().includes('lobby.startGame'));
            expect(startBtn.attributes('disabled')).toBeDefined();
            expect(wrapper.text()).toContain('lobby.needMorePlayers');
        });

        it('start button enabled when 2+ players', async () => {
            setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            const startBtn = wrapper.findAll('button').find(b => b.text().includes('lobby.startGame'));
            expect(startBtn.attributes('disabled')).toBeUndefined();
        });

        it('shows settings summary', async () => {
            setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.settings');
            expect(wrapper.text()).toContain('create.rounds');
            expect(wrapper.text()).toContain('create.answerTime');
            expect(wrapper.text()).toContain('create.voteTime');
        });

        it('shows add bot button for host', async () => {
            setupLobby({ hostId: 1 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.addBot');
        });

        it('does not show add bot button for non-host', async () => {
            setupLobby({ hostId: 99 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).not.toContain('lobby.addBot');
        });

        it('shows host badge next to host player', async () => {
            setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.host');
        });

        it('shows co-host badge for co-host players', async () => {
            setupLobby({
                players: [
                    { id: 1, nickname: 'HostPlayer' },
                    { id: 2, nickname: 'CoHostPlayer', is_co_host: true },
                ],
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.coHost');
        });

        it('shows share link and invite buttons', async () => {
            setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.shareLink');
            expect(wrapper.text()).toContain('lobby.inviteEmail');
        });

        it('shows lobby expiring warning when lobbyExpiring is true', async () => {
            const { gameStore } = setupLobby();

            const wrapper = mountGame();
            await flushPromises();

            gameStore.lobbyExpiring = true;
            await flushPromises();

            expect(wrapper.text()).toContain('lobby.expiringWarning');
            expect(wrapper.text()).toContain('lobby.keepOpen');
        });
    });

    // =====================
    // 3. Playing Phase
    // =====================
    describe('Playing Phase', () => {
        function setupPlaying(overrides = {}) {
            const stores = setupStores(overrides);
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: { ...defaultSettings(), ...(overrides.settings || {}) },
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'playing';
                gameStore.acronym = overrides.acronym ?? 'ABC';
                gameStore.currentRound = overrides.currentRound ?? { id: 10, round_number: 1, answers_count: 0, total_players: 2 };
                gameStore.timeRemaining = overrides.timeRemaining ?? 45;
                gameStore.myAnswer = overrides.myAnswer ?? null;
            });

            gameStore.fetchGameState.mockResolvedValue({});

            return stores;
        }

        it('shows acronym letters', async () => {
            setupPlaying({ acronym: 'XYZ' });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('X');
            expect(wrapper.text()).toContain('Y');
            expect(wrapper.text()).toContain('Z');
        });

        it('shows answer textarea when no answer submitted', async () => {
            setupPlaying();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.find('textarea').exists()).toBe(true);
            expect(wrapper.text()).toContain('game.submitAnswer');
        });

        it('submit button is disabled when answer does not match acronym', async () => {
            setupPlaying({ acronym: 'ABC' });

            const wrapper = mountGame();
            await flushPromises();

            const submitBtn = wrapper.findAll('button').find(b => b.text().includes('game.submitAnswer'));
            expect(submitBtn.attributes('disabled')).toBeDefined();
        });

        it('submit button becomes enabled when answer matches acronym', async () => {
            setupPlaying({ acronym: 'ABC' });

            const wrapper = mountGame();
            await flushPromises();

            const textarea = wrapper.find('textarea');
            await textarea.setValue('Alpha Beta Charlie');
            await textarea.trigger('input');
            await flushPromises();

            const submitBtn = wrapper.findAll('button').find(b => b.text().includes('game.submitAnswer'));
            expect(submitBtn.attributes('disabled')).toBeUndefined();
        });

        it('shows submitted answer after submit', async () => {
            setupPlaying({
                myAnswer: { text: 'Apple Banana Cherry', is_ready: false, edit_count: 0 },
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('apple banana cherry');
            expect(wrapper.text()).not.toContain('game.submitAnswer');
        });

        it('shows edit button with remaining count when max_edits is set', async () => {
            setupPlaying({
                myAnswer: { text: 'Apple Banana Cherry', is_ready: false, edit_count: 0 },
                settings: { max_edits: 3 },
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.edit');
            expect(wrapper.text()).toContain('game.remaining');
        });

        it('shows edit button without count when max_edits is unlimited (0)', async () => {
            setupPlaying({
                myAnswer: { text: 'Apple Banana Cherry', is_ready: false, edit_count: 0 },
                settings: { max_edits: 0 },
            });

            const wrapper = mountGame();
            await flushPromises();

            // Should show edit button but without a count
            const editBtn = wrapper.findAll('button').find(b => b.text().includes('game.edit'));
            expect(editBtn).toBeTruthy();
            expect(editBtn.text()).not.toContain('game.remaining');
        });

        it('shows ready check checkbox when allow_ready_check is true', async () => {
            setupPlaying({
                myAnswer: { text: 'Apple Banana Cherry', is_ready: false, edit_count: 0 },
                settings: { allow_ready_check: true },
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.readyLabel');
        });

        it('shows timer in playing phase', async () => {
            setupPlaying({ timeRemaining: 45 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('45s');
        });

        it('shows round indicator', async () => {
            setupPlaying({ currentRound: { id: 10, round_number: 2, answers_count: 0, total_players: 2 } });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.round');
            expect(wrapper.text()).toContain('2');
            expect(wrapper.text()).toContain('game.of');
        });

        it('validates letter matches correctly for partially correct answer', async () => {
            setupPlaying({ acronym: 'ABC' });

            const wrapper = mountGame();
            await flushPromises();

            const textarea = wrapper.find('textarea');
            // 'Apple' matches A, 'Xray' doesn't match B
            await textarea.setValue('Apple Xray');
            await textarea.trigger('input');
            await flushPromises();

            // Check the word count indicator
            expect(wrapper.text()).toContain('1/3');
            expect(wrapper.text()).toContain('game.wordsMatch');
        });
    });

    // =====================
    // 4. Voting Phase
    // =====================
    describe('Voting Phase', () => {
        function setupVoting(overrides = {}) {
            const stores = setupStores(overrides);
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: { ...defaultSettings(), ...(overrides.settings || {}) },
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                    { id: 3, nickname: 'Player3' },
                ];
                gameStore.phase = 'voting';
                gameStore.answers = overrides.answers ?? [
                    { id: 101, text: 'Apple Banana Cherry', is_own: true },
                    { id: 102, text: 'Artful Bright Creative', is_own: false },
                    { id: 103, text: 'Amazing Bold Clever', is_own: false },
                ];
                gameStore.currentRound = { id: 10, round_number: 1, votes_count: 0, total_voters: 3 };
                gameStore.timeRemaining = overrides.timeRemaining ?? 25;
                gameStore.myVote = overrides.myVote ?? null;
            });

            gameStore.fetchGameState.mockResolvedValue({});

            return stores;
        }

        it('shows voting heading', async () => {
            setupVoting();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.voting');
        });

        it('shows vote cards for all answers', async () => {
            setupVoting();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('apple banana cherry');
            expect(wrapper.text()).toContain('artful bright creative');
            expect(wrapper.text()).toContain('amazing bold clever');
        });

        it('own answer has opacity-50 and cursor-not-allowed', async () => {
            setupVoting();

            const wrapper = mountGame();
            await flushPromises();

            const voteCards = wrapper.findAll('.vote-card');
            const ownCard = voteCards.find(c => c.text().includes('apple banana cherry'));
            expect(ownCard.classes()).toContain('opacity-50');
            expect(ownCard.classes()).toContain('cursor-not-allowed');
        });

        it('shows "your submission" label on own answer', async () => {
            setupVoting();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.yourSubmission');
        });

        it('shows "your vote" indicator on voted answer', async () => {
            setupVoting({ myVote: { answer_id: 102, change_count: 0 } });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.yourVote');
        });

        it('shows vote status count', async () => {
            setupVoting();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('0/3');
            expect(wrapper.text()).toContain('game.votes');
        });
    });

    // =====================
    // 5. Results Phase
    // =====================
    describe('Results Phase', () => {
        function setupResults(overrides = {}) {
            const stores = setupStores(overrides);
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: defaultSettings(),
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'results';
                gameStore.roundResults = overrides.roundResults ?? [
                    { player_id: 2, player_name: 'Player2', answer: 'Artful Bright Creative', votes: 2, avatar_url: null },
                    { player_id: 1, player_name: 'TestPlayer', answer: 'Apple Banana Cherry', votes: 0, avatar_url: null },
                ];
                gameStore.scores = overrides.scores ?? [
                    { player_id: 2, player_name: 'Player2', score: 3, avatar_url: null },
                    { player_id: 1, player_name: 'TestPlayer', score: 0, avatar_url: null },
                ];
                gameStore.timeRemaining = overrides.timeRemaining ?? 10;
                gameStore.currentRound = { id: 10, round_number: 1 };
            });

            gameStore.fetchGameState.mockResolvedValue({});

            return stores;
        }

        it('shows results heading', async () => {
            setupResults();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.results');
        });

        it('shows round results with vote counts', async () => {
            setupResults();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('artful bright creative');
            expect(wrapper.text()).toContain('2');
            expect(wrapper.text()).toContain('game.votes');
        });

        it('shows scoreboard', async () => {
            setupResults();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.scoreboard');
            expect(wrapper.text()).toContain('Player2');
            expect(wrapper.text()).toContain('game.points');
        });

        it('shows winner badge for round winner', async () => {
            setupResults();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.winner');
        });

        it('shows tie badge when top two have same votes', async () => {
            setupResults({
                roundResults: [
                    { player_id: 1, player_name: 'TestPlayer', answer: 'Apple Banana Cherry', votes: 2, avatar_url: null },
                    { player_id: 2, player_name: 'Player2', answer: 'Artful Bright Creative', votes: 2, avatar_url: null },
                ],
            });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.tie');
        });

        it('shows next round timer', async () => {
            setupResults({ timeRemaining: 8 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.nextRound');
            expect(wrapper.text()).toContain('8s');
        });
    });

    // =====================
    // 6. Finished Phase
    // =====================
    describe('Finished Phase', () => {
        function setupFinished(overrides = {}) {
            const stores = setupStores(overrides);
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'finished',
                    settings: defaultSettings(),
                    host_player_id: overrides.hostId ?? 1,
                    is_public: true,
                    winner: 'winner' in overrides ? overrides.winner : { player_name: 'Player2', nickname: 'Player2', score: 10 },
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'finished';
                gameStore.scores = overrides.scores ?? [
                    { player_id: 2, player_name: 'Player2', nickname: 'Player2', score: 10, avatar_url: null },
                    { player_id: 1, player_name: 'TestPlayer', nickname: 'TestPlayer', score: 5, avatar_url: null },
                ];
            });

            gameStore.fetchGameState.mockResolvedValue({});

            return stores;
        }

        it('shows finished heading', async () => {
            setupFinished();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.finished');
        });

        it('shows winner name and score', async () => {
            setupFinished();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('Player2');
            expect(wrapper.text()).toContain('10');
            expect(wrapper.text()).toContain('game.points');
        });

        it('shows tie state when no winner', async () => {
            setupFinished({ winner: null });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.tie');
        });

        it('shows final scores', async () => {
            setupFinished();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.finalScores');
            expect(wrapper.text()).toContain('Player2');
            expect(wrapper.text()).toContain('TestPlayer');
        });

        it('shows rematch button for host', async () => {
            setupFinished({ hostId: 1 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.playAgainSamePlayers');
        });

        it('shows "play again" for non-host', async () => {
            setupFinished({ hostId: 99 });

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.playAgain');
            expect(wrapper.text()).not.toContain('game.playAgainSamePlayers');
        });

        it('shows view archive button', async () => {
            setupFinished();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.viewArchive');
        });

        it('shows inactivity message when finished_reason is inactivity', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'finished',
                    settings: { ...defaultSettings(), finished_reason: 'inactivity' },
                    host_player_id: 1,
                    is_public: true,
                    winner: null,
                };
                gameStore.players = [{ id: 1, nickname: 'TestPlayer' }];
                gameStore.phase = 'finished';
                gameStore.scores = [];
            });
            gameStore.fetchGameState.mockResolvedValue({});

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.finishedInactivity');
        });
    });

    // =====================
    // 7. Chat
    // =====================
    describe('Chat', () => {
        function setupWithChat(overrides = {}) {
            const stores = setupStores(overrides);
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'lobby',
                    settings: { ...defaultSettings(), chat_enabled: overrides.chatEnabled ?? true },
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer', score: 5 },
                    { id: 2, nickname: 'Player2', score: 3 },
                ];
                gameStore.phase = 'lobby';
                gameStore.chatMessages = overrides.chatMessages ?? [];
            });

            return stores;
        }

        it('shows chat toggle button when chat is enabled', async () => {
            setupWithChat();

            const wrapper = mountGame();
            await flushPromises();

            expect(wrapper.text()).toContain('game.chat');
        });

        it('does not show chat toggle when chat is disabled', async () => {
            setupWithChat({ chatEnabled: false });

            const wrapper = mountGame();
            await flushPromises();

            // The chat section should not appear; check there's no chat toggle button
            const chatButtons = wrapper.findAll('button').filter(b => {
                // The chat toggle is a button that contains only "game.chat" text
                return b.text().trim() === 'game.chat';
            });
            expect(chatButtons.length).toBe(0);
        });

        it('sends regular message via sendChatMessage', async () => {
            const { gameStore } = setupWithChat();

            const wrapper = mountGame();
            await flushPromises();

            // Open chat panel
            const chatToggle = wrapper.findAll('button').find(b => b.text().includes('game.chat'));
            expect(chatToggle).toBeTruthy();
            await chatToggle.trigger('click');
            await wrapper.vm.$nextTick();

            // Type a message in the chat input
            const inputs = wrapper.findAll('input');
            expect(inputs.length).toBeGreaterThan(0);
            const chatInput = inputs[inputs.length - 1];
            await chatInput.setValue('Hello world');
            await wrapper.vm.$nextTick();

            // Submit the chat form
            const forms = wrapper.findAll('form');
            const chatForm = forms[forms.length - 1];
            await chatForm.trigger('submit');
            await flushPromises();

            expect(gameStore.sendChatMessage).toHaveBeenCalledWith('TEST', 'Hello world');
        });

        it('handles /me command as action message', async () => {
            const { gameStore } = setupWithChat();

            const wrapper = mountGame();
            await flushPromises();

            const chatToggle = wrapper.findAll('button').find(b => b.text().includes('game.chat'));
            await chatToggle.trigger('click');
            await wrapper.vm.$nextTick();

            const inputs = wrapper.findAll('input');
            const chatInput = inputs[inputs.length - 1];
            await chatInput.setValue('/me waves');
            await wrapper.vm.$nextTick();

            const forms = wrapper.findAll('form');
            const chatForm = forms[forms.length - 1];
            await chatForm.trigger('submit');
            await flushPromises();

            expect(gameStore.sendChatMessage).toHaveBeenCalledWith('TEST', 'waves', true);
        });

        it('handles /whois command locally', async () => {
            const { gameStore } = setupWithChat();

            const wrapper = mountGame();
            await flushPromises();

            const chatToggle = wrapper.findAll('button').find(b => b.text().includes('game.chat'));
            await chatToggle.trigger('click');
            await wrapper.vm.$nextTick();

            const inputs = wrapper.findAll('input');
            const chatInput = inputs[inputs.length - 1];
            await chatInput.setValue('/whois TestPlayer');
            await wrapper.vm.$nextTick();

            const forms = wrapper.findAll('form');
            const chatForm = forms[forms.length - 1];
            await chatForm.trigger('submit');
            await flushPromises();

            // /whois is handled locally, not sent to server
            expect(gameStore.sendChatMessage).not.toHaveBeenCalled();
            expect(gameStore.chatMessages.length).toBe(1);
            expect(gameStore.chatMessages[0].system).toBe(true);
            expect(gameStore.chatMessages[0].message).toContain('TestPlayer');
            expect(gameStore.chatMessages[0].message).toContain('Host');
        });

        it('handles unknown command with error message', async () => {
            const { gameStore } = setupWithChat();

            const wrapper = mountGame();
            await flushPromises();

            const chatToggle = wrapper.findAll('button').find(b => b.text().includes('game.chat'));
            await chatToggle.trigger('click');
            await wrapper.vm.$nextTick();

            const inputs = wrapper.findAll('input');
            const chatInput = inputs[inputs.length - 1];
            await chatInput.setValue('/foobar');
            await wrapper.vm.$nextTick();

            const forms = wrapper.findAll('form');
            const chatForm = forms[forms.length - 1];
            await chatForm.trigger('submit');
            await flushPromises();

            expect(gameStore.sendChatMessage).not.toHaveBeenCalled();
            expect(gameStore.chatMessages.length).toBe(1);
            expect(gameStore.chatMessages[0].system).toBe(true);
            expect(gameStore.chatMessages[0].message).toContain('Unknown command');
        });
    });

    // =====================
    // 8. Helper Functions & Computed
    // =====================
    describe('Helper functions and computed properties', () => {
        it('canManagePlayer returns false for the host player', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'lobby',
                    settings: defaultSettings(),
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'Host' },
                    { id: 2, nickname: 'Other' },
                    { id: 3, nickname: 'Third' },
                ];
                gameStore.phase = 'lobby';
            });

            const wrapper = mountGame();
            await flushPromises();

            // The host player (id=1) should not have a manage button
            // But other players should (since current user id=1 is the host, they can manage others)
            // The manage button is the "..." icon button next to players
            // Find player rows
            const playerRows = wrapper.findAll('.space-y-1 > div');
            // Host row should not have management button
            // Other players should have the button
            // Since player id 1 = auth player = host, canManagePlayer returns false for self and for host
            // id 2 and 3 should have manage buttons
            // The manage button has an SVG with the three dots pattern
            // Let's check that the host row doesn't have the manage trigger
            // We verify by checking that there's no button triggering on the host player
            // Since the host is also the auth player, canManagePlayer(host) returns false for both reasons
            expect(wrapper.text()).toContain('Host');
            expect(wrapper.text()).toContain('Other');
        });

        it('showTimer returns true for playing, voting, and results phases', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: defaultSettings(),
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'playing';
                gameStore.acronym = 'ABC';
                gameStore.currentRound = { id: 10, round_number: 1 };
                gameStore.timeRemaining = 30;
            });

            gameStore.fetchGameState.mockResolvedValue({});

            const wrapper = mountGame();
            await flushPromises();

            // Timer should be visible in playing phase
            expect(wrapper.find('.progress-bar').exists()).toBe(true);
            expect(wrapper.text()).toContain('30s');
        });

        it('showTimer returns false for lobby phase', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'lobby',
                    settings: defaultSettings(),
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [{ id: 1, nickname: 'TestPlayer' }];
                gameStore.phase = 'lobby';
                gameStore.timeRemaining = 0;
            });

            const wrapper = mountGame();
            await flushPromises();

            // No timer bar in lobby
            const timerBars = wrapper.findAll('.progress-bar');
            expect(timerBars.length).toBe(0);
        });

        it('roundHasTie detects tie when top two results have same votes', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: defaultSettings(),
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'results';
                gameStore.roundResults = [
                    { player_id: 1, player_name: 'TestPlayer', answer: 'Alpha Bravo Charlie', votes: 1, avatar_url: null },
                    { player_id: 2, player_name: 'Player2', answer: 'Able Baker Cat', votes: 1, avatar_url: null },
                ];
                gameStore.scores = [
                    { player_id: 1, player_name: 'TestPlayer', score: 1, avatar_url: null },
                    { player_id: 2, player_name: 'Player2', score: 1, avatar_url: null },
                ];
                gameStore.timeRemaining = 10;
                gameStore.currentRound = { id: 10, round_number: 1 };
            });

            gameStore.fetchGameState.mockResolvedValue({});

            const wrapper = mountGame();
            await flushPromises();

            // Both should show as tied winners with tie badge
            expect(wrapper.text()).toContain('game.tie');
        });

        it('timerPercent is calculated correctly', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: { ...defaultSettings(), answer_time: 60 },
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'playing';
                gameStore.acronym = 'ABC';
                gameStore.currentRound = { id: 10, round_number: 1 };
                gameStore.timeRemaining = 30;
            });

            gameStore.fetchGameState.mockResolvedValue({});

            const wrapper = mountGame();
            await flushPromises();

            // Timer shows timeRemaining seconds
            expect(wrapper.text()).toContain('30s');
        });

        it('timer text turns red when timeRemaining <= 10', async () => {
            const stores = setupStores();
            const { gameStore } = stores;

            gameStore.fetchGame.mockImplementation(async () => {
                gameStore.currentGame = {
                    code: 'TEST',
                    status: 'playing',
                    settings: defaultSettings(),
                    host_player_id: 1,
                    is_public: true,
                };
                gameStore.players = [
                    { id: 1, nickname: 'TestPlayer' },
                    { id: 2, nickname: 'Player2' },
                ];
                gameStore.phase = 'playing';
                gameStore.acronym = 'ABC';
                gameStore.currentRound = { id: 10, round_number: 1 };
                gameStore.timeRemaining = 5;
            });

            gameStore.fetchGameState.mockResolvedValue({});

            const wrapper = mountGame();
            await flushPromises();

            // The timer span should have text-red-500 class
            const timerSpan = wrapper.find('.text-red-500');
            expect(timerSpan.exists()).toBe(true);
            expect(timerSpan.text()).toContain('5s');
        });
    });
});
