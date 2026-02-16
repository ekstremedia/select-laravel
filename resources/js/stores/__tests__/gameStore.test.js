import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '../gameStore.js';

vi.mock('../../services/api.js', () => ({
    api: {
        auth: {
            guest: vi.fn(),
            login: vi.fn(),
            me: vi.fn(),
        },
        games: {
            get: vi.fn(),
            create: vi.fn(),
            join: vi.fn(),
            leave: vi.fn(),
            start: vi.fn(),
            currentRound: vi.fn(),
            state: vi.fn(),
            chat: vi.fn(),
            updateVisibility: vi.fn(),
            updateSettings: vi.fn(),
            kick: vi.fn(),
            ban: vi.fn(),
            unban: vi.fn(),
            toggleCoHost: vi.fn(),
            addBot: vi.fn(),
            removeBot: vi.fn(),
            end: vi.fn(),
            keepalive: vi.fn(),
            rematch: vi.fn(),
        },
        rounds: {
            submitAnswer: vi.fn(),
            submitVote: vi.fn(),
            retractVote: vi.fn(),
            markReady: vi.fn(),
        },
    },
}));

vi.mock('../../services/websocket.js', () => ({
    joinGame: vi.fn(() => {
        const listeners = {};
        const channel = {
            _code: null,
            _listeners: listeners,
            here: vi.fn().mockReturnThis(),
            joining: vi.fn().mockReturnThis(),
            leaving: vi.fn().mockReturnThis(),
            listen: vi.fn((event, cb) => {
                listeners[event] = cb;
                return channel;
            }),
        };
        return channel;
    }),
    leaveGame: vi.fn(),
}));

vi.mock('../soundStore.js', () => ({
    useSoundStore: vi.fn(() => ({
        play: vi.fn(),
    })),
}));

import { api } from '../../services/api.js';
import { joinGame as wsJoinGame, leaveGame as wsLeaveGame } from '../../services/websocket.js';

describe('gameStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('initial state', () => {
        it('phase is null', () => {
            const store = useGameStore();
            expect(store.phase).toBeNull();
        });

        it('players is empty array', () => {
            const store = useGameStore();
            expect(store.players).toEqual([]);
        });

        it('currentGame is null', () => {
            const store = useGameStore();
            expect(store.currentGame).toBeNull();
        });

        it('currentRound is null', () => {
            const store = useGameStore();
            expect(store.currentRound).toBeNull();
        });

        it('acronym is empty string', () => {
            const store = useGameStore();
            expect(store.acronym).toBe('');
        });

        it('answers is empty array', () => {
            const store = useGameStore();
            expect(store.answers).toEqual([]);
        });

        it('myAnswer is null', () => {
            const store = useGameStore();
            expect(store.myAnswer).toBeNull();
        });

        it('myVote is null', () => {
            const store = useGameStore();
            expect(store.myVote).toBeNull();
        });

        it('scores is empty array', () => {
            const store = useGameStore();
            expect(store.scores).toEqual([]);
        });

        it('deadline is null', () => {
            const store = useGameStore();
            expect(store.deadline).toBeNull();
        });

        it('timeRemaining is 0', () => {
            const store = useGameStore();
            expect(store.timeRemaining).toBe(0);
        });

        it('chatMessages is empty array', () => {
            const store = useGameStore();
            expect(store.chatMessages).toEqual([]);
        });

        it('roundResults is null', () => {
            const store = useGameStore();
            expect(store.roundResults).toBeNull();
        });
    });

    describe('fetchGame', () => {
        it('sets currentGame, players, and phase from response', async () => {
            const mockGame = {
                id: 'game-1',
                code: 'ABCDEF',
                status: 'lobby',
                host_player_id: 'host-uuid',
                players: [
                    { id: 'p1', nickname: 'Player1' },
                    { id: 'p2', nickname: 'Player2' },
                ],
            };
            api.games.get.mockResolvedValue({ data: { game: mockGame } });

            const store = useGameStore();
            const result = await store.fetchGame('ABCDEF');

            expect(api.games.get).toHaveBeenCalledWith('ABCDEF');
            expect(store.currentGame).toEqual(mockGame);
            expect(store.players).toEqual(mockGame.players);
            expect(store.phase).toBe('lobby');
            expect(result).toEqual({ game: mockGame });
        });

        it('sets phase to playing when status is playing', async () => {
            const mockGame = {
                id: 'game-2',
                code: 'XYZABC',
                status: 'playing',
                players: [],
            };
            api.games.get.mockResolvedValue({ data: { game: mockGame } });

            const store = useGameStore();
            await store.fetchGame('XYZABC');

            expect(store.phase).toBe('playing');
        });

        it('sets phase to finished when status is finished', async () => {
            const mockGame = {
                id: 'game-3',
                code: 'FINSIH',
                status: 'finished',
                players: [],
            };
            api.games.get.mockResolvedValue({ data: { game: mockGame } });

            const store = useGameStore();
            await store.fetchGame('FINSIH');

            expect(store.phase).toBe('finished');
        });

        it('defaults players to empty array when game has no players', async () => {
            const mockGame = {
                id: 'game-4',
                code: 'NOPLYR',
                status: 'lobby',
            };
            api.games.get.mockResolvedValue({ data: { game: mockGame } });

            const store = useGameStore();
            await store.fetchGame('NOPLYR');

            expect(store.players).toEqual([]);
        });
    });

    describe('resetState', () => {
        it('clears everything back to initial state', async () => {
            const mockGame = {
                id: 'game-5',
                code: 'RESETM',
                status: 'playing',
                players: [{ id: 'p1' }],
            };
            api.games.get.mockResolvedValue({ data: { game: mockGame } });

            const store = useGameStore();
            await store.fetchGame('RESETM');
            store.myAnswer = { id: 'a1', text: 'test' };
            store.myVote = { id: 'v1' };
            store.scores = [{ player_id: 'p1', score: 5 }];
            store.acronym = 'TEST';
            store.answers = [{ id: 'a1' }];
            store.chatMessages = [{ message: 'hello' }];
            store.roundResults = [{ answer_id: 'a1', votes: 3 }];

            store.resetState();

            expect(store.currentGame).toBeNull();
            expect(store.players).toEqual([]);
            expect(store.currentRound).toBeNull();
            expect(store.phase).toBeNull();
            expect(store.acronym).toBe('');
            expect(store.answers).toEqual([]);
            expect(store.myAnswer).toBeNull();
            expect(store.myVote).toBeNull();
            expect(store.scores).toEqual([]);
            expect(store.deadline).toBeNull();
            expect(store.timeRemaining).toBe(0);
            expect(store.chatMessages).toEqual([]);
            expect(store.roundResults).toBeNull();
        });
    });

    describe('_syncPhase (via fetchGame)', () => {
        it('maps lobby status to lobby phase', async () => {
            api.games.get.mockResolvedValue({ data: { game: { status: 'lobby', players: [] } } });
            const store = useGameStore();
            await store.fetchGame('CODE01');
            expect(store.phase).toBe('lobby');
        });

        it('maps playing status to playing phase', async () => {
            api.games.get.mockResolvedValue({ data: { game: { status: 'playing', players: [] } } });
            const store = useGameStore();
            await store.fetchGame('CODE02');
            expect(store.phase).toBe('playing');
        });

        it('maps finished status to finished phase', async () => {
            api.games.get.mockResolvedValue({ data: { game: { status: 'finished', players: [] } } });
            const store = useGameStore();
            await store.fetchGame('CODE03');
            expect(store.phase).toBe('finished');
        });

        it('does not change phase for unknown status', async () => {
            const store = useGameStore();
            store.phase = 'voting';
            api.games.get.mockResolvedValue({ data: { game: { status: 'unknown_status', players: [] } } });
            await store.fetchGame('CODE04');
            // _syncPhase doesn't handle unknown statuses, so phase stays as-is
            expect(store.phase).toBe('voting');
        });
    });

    describe('hasSubmittedAnswer', () => {
        it('returns false when myAnswer is null', () => {
            const store = useGameStore();
            expect(store.hasSubmittedAnswer).toBe(false);
        });

        it('returns true when myAnswer is set', () => {
            const store = useGameStore();
            store.myAnswer = { id: 'a1', text: 'Test answer' };
            expect(store.hasSubmittedAnswer).toBe(true);
        });
    });

    describe('hasVoted', () => {
        it('returns false when myVote is null', () => {
            const store = useGameStore();
            expect(store.hasVoted).toBe(false);
        });

        it('returns true when myVote is set', () => {
            const store = useGameStore();
            store.myVote = { id: 'v1', answer_id: 'a2' };
            expect(store.hasVoted).toBe(true);
        });
    });

    describe('gameCode', () => {
        it('returns null when no current game', () => {
            const store = useGameStore();
            expect(store.gameCode).toBeNull();
        });

        it('returns the game code when currentGame is set', () => {
            const store = useGameStore();
            store.currentGame = { id: 'game-6', code: 'MYCODE' };
            expect(store.gameCode).toBe('MYCODE');
        });
    });

    describe('createGame', () => {
        it('sets currentGame, players, and phase to lobby', async () => {
            const mockGame = {
                id: 'game-7',
                code: 'NEWGAM',
                status: 'lobby',
                players: [{ id: 'host-1', nickname: 'Host' }],
            };
            api.games.create.mockResolvedValue({ data: { game: mockGame } });

            const store = useGameStore();
            const result = await store.createGame({ rounds: 5 });

            expect(api.games.create).toHaveBeenCalledWith({ rounds: 5 });
            expect(store.currentGame).toEqual(mockGame);
            expect(store.players).toEqual(mockGame.players);
            expect(store.phase).toBe('lobby');
            expect(result).toEqual({ game: mockGame });
        });
    });

    describe('submitAnswer', () => {
        it('sets myAnswer from response', async () => {
            const mockAnswer = { id: 'ans-1', text: 'This Is A Test', round_id: 'r1' };
            api.rounds.submitAnswer.mockResolvedValue({ data: { answer: mockAnswer } });

            const store = useGameStore();
            const result = await store.submitAnswer('r1', 'This Is A Test');

            expect(api.rounds.submitAnswer).toHaveBeenCalledWith('r1', 'This Is A Test');
            expect(store.myAnswer).toEqual(mockAnswer);
            expect(result).toEqual({ answer: mockAnswer });
        });
    });

    describe('submitVote', () => {
        it('sets myVote from response', async () => {
            const mockVote = { id: 'vote-1', answer_id: 'ans-2' };
            api.rounds.submitVote.mockResolvedValue({ data: { vote: mockVote } });

            const store = useGameStore();
            const result = await store.submitVote('r1', 'ans-2');

            expect(api.rounds.submitVote).toHaveBeenCalledWith('r1', 'ans-2');
            expect(store.myVote).toEqual(mockVote);
            expect(result).toEqual({ vote: mockVote });
        });
    });

    describe('leaveGame', () => {
        it('calls api and resets state', async () => {
            api.games.leave.mockResolvedValue({ data: { success: true } });
            api.games.get.mockResolvedValue({
                data: { game: { id: 'g1', code: 'LEAVEG', status: 'lobby', players: [{ id: 'p1' }] } },
            });

            const store = useGameStore();
            await store.fetchGame('LEAVEG');
            expect(store.currentGame).not.toBeNull();

            await store.leaveGame('LEAVEG');

            expect(api.games.leave).toHaveBeenCalledWith('LEAVEG');
            expect(store.currentGame).toBeNull();
            expect(store.phase).toBeNull();
            expect(store.players).toEqual([]);
        });
    });

    describe('disconnectWebSocket', () => {
        it('calls wsLeaveGame when channel exists', () => {
            const store = useGameStore();
            store.connectWebSocket('WSCODE');

            store.disconnectWebSocket();

            expect(wsLeaveGame).toHaveBeenCalled();
            // Calling disconnect again should not call wsLeaveGame a second time
            // because the channel was already cleared
            wsLeaveGame.mockClear();
            store.disconnectWebSocket();
            expect(wsLeaveGame).not.toHaveBeenCalled();
        });

        it('does nothing when no channel', () => {
            const store = useGameStore();
            store.disconnectWebSocket();

            expect(wsLeaveGame).not.toHaveBeenCalled();
        });
    });

    describe('lastPlayerEvent', () => {
        it('initial state should be null', () => {
            const store = useGameStore();
            expect(store.lastPlayerEvent).toBeNull();
        });
    });

    describe('lastSettingsEvent', () => {
        it('initial state should be null', () => {
            const store = useGameStore();
            expect(store.lastSettingsEvent).toBeNull();
        });
    });

    describe('updateVisibility', () => {
        it('calls api.games.updateVisibility with code and isPublic', async () => {
            api.games.updateVisibility.mockResolvedValue({ data: { is_public: true } });

            const store = useGameStore();
            store.currentGame = { id: 'g1', code: 'VISGAM', is_public: false };

            await store.updateVisibility('VISGAM', true);

            expect(api.games.updateVisibility).toHaveBeenCalledWith('VISGAM', true);
        });

        it('updates currentGame.is_public from response', async () => {
            api.games.updateVisibility.mockResolvedValue({ data: { is_public: true } });

            const store = useGameStore();
            store.currentGame = { id: 'g1', code: 'VISGAM', is_public: false };

            await store.updateVisibility('VISGAM', true);

            expect(store.currentGame.is_public).toBe(true);
        });

        it('updates currentGame.has_password from response when present', async () => {
            api.games.updateVisibility.mockResolvedValue({ data: { is_public: false, has_password: true } });

            const store = useGameStore();
            store.currentGame = { id: 'g1', code: 'VISGAM', is_public: true, has_password: false };

            await store.updateVisibility('VISGAM', false);

            expect(store.currentGame.is_public).toBe(false);
            expect(store.currentGame.has_password).toBe(true);
        });
    });

    describe('updateSettings', () => {
        it('calls api.games.updateSettings with code and payload', async () => {
            const payload = { max_players: 8, time_limit: 60 };
            api.games.updateSettings.mockResolvedValue({ data: { settings: payload, is_public: true } });

            const store = useGameStore();
            store.currentGame = { id: 'g1', code: 'SETGAM', settings: {}, is_public: false };

            await store.updateSettings('SETGAM', payload);

            expect(api.games.updateSettings).toHaveBeenCalledWith('SETGAM', payload);
        });

        it('updates currentGame.settings and currentGame.is_public from response', async () => {
            const newSettings = { max_players: 8, time_limit: 60 };
            api.games.updateSettings.mockResolvedValue({ data: { settings: newSettings, is_public: true } });

            const store = useGameStore();
            store.currentGame = { id: 'g1', code: 'SETGAM', settings: {}, is_public: false };

            await store.updateSettings('SETGAM', newSettings);

            expect(store.currentGame.settings).toEqual(newSettings);
            expect(store.currentGame.is_public).toBe(true);
        });

        it('updates currentGame.has_password from response when present', async () => {
            const newSettings = { max_players: 8 };
            api.games.updateSettings.mockResolvedValue({ data: { settings: newSettings, is_public: false, has_password: true } });

            const store = useGameStore();
            store.currentGame = { id: 'g1', code: 'SETGAM', settings: {}, is_public: true, has_password: false };

            await store.updateSettings('SETGAM', newSettings);

            expect(store.currentGame.has_password).toBe(true);
        });
    });

    describe('WebSocket event handlers', () => {
        function setupStoreWithWebSocket() {
            const store = useGameStore();
            store.currentGame = {
                id: 'g1',
                code: 'WSCODE',
                status: 'lobby',
                is_public: true,
                has_password: false,
                settings: { chat_enabled: true },
            };
            store.players = [
                { id: 'p1', nickname: 'Alice' },
                { id: 'p2', nickname: 'Bob' },
            ];
            store.connectWebSocket('WSCODE');
            const channel = wsJoinGame.mock.results[wsJoinGame.mock.results.length - 1].value;
            return { store, listeners: channel._listeners };
        }

        it('.player.joined adds player to players array and sets lastPlayerEvent', () => {
            const { store, listeners } = setupStoreWithWebSocket();
            const newPlayer = { id: 'p3', nickname: 'Charlie' };

            listeners['.player.joined']({ player: newPlayer });

            expect(store.players).toContainEqual(newPlayer);
            expect(store.lastPlayerEvent).toEqual({ type: 'joined', nickname: 'Charlie' });
        });

        it('.player.left removes player and sets lastPlayerEvent with nickname', () => {
            const { store, listeners } = setupStoreWithWebSocket();

            listeners['.player.left']({ player_id: 'p2' });

            expect(store.players.find(p => p.id === 'p2')).toBeUndefined();
            expect(store.lastPlayerEvent).toEqual({ type: 'left', nickname: 'Bob' });
        });

        it('.player.nickname_changed updates player nickname and sets lastPlayerEvent', () => {
            const { store, listeners } = setupStoreWithWebSocket();

            listeners['.player.nickname_changed']({
                player_id: 'p1',
                old_nickname: 'Alice',
                new_nickname: 'AliceNew',
            });

            const player = store.players.find(p => p.id === 'p1');
            expect(player.nickname).toBe('AliceNew');
            expect(store.lastPlayerEvent).toEqual({
                type: 'nickname_changed',
                oldNickname: 'Alice',
                newNickname: 'AliceNew',
            });
        });

        it('.game.settings_changed updates currentGame.settings, is_public, has_password', () => {
            const { store, listeners } = setupStoreWithWebSocket();
            const newSettings = { chat_enabled: true, max_players: 10 };

            listeners['.game.settings_changed']({
                settings: newSettings,
                is_public: false,
                has_password: true,
            });

            expect(store.currentGame.settings).toEqual(newSettings);
            expect(store.currentGame.is_public).toBe(false);
            expect(store.currentGame.has_password).toBe(true);
        });

        it('.game.settings_changed detects chat_enabled change and sets lastSettingsEvent', () => {
            const { store, listeners } = setupStoreWithWebSocket();

            listeners['.game.settings_changed']({
                settings: { chat_enabled: false },
                changed_by: 'Alice',
            });

            expect(store.lastSettingsEvent).not.toBeNull();
            expect(store.lastSettingsEvent.changes).toContainEqual({ type: 'chat_disabled' });
            expect(store.lastSettingsEvent.changedBy).toBe('Alice');
        });

        it('.game.settings_changed detects is_public change and sets lastSettingsEvent', () => {
            const { store, listeners } = setupStoreWithWebSocket();

            listeners['.game.settings_changed']({
                is_public: false,
                changed_by: 'Bob',
            });

            expect(store.lastSettingsEvent).not.toBeNull();
            expect(store.lastSettingsEvent.changes).toContainEqual({ type: 'visibility_private' });
        });

        it('.game.settings_changed detects password_changed and sets lastSettingsEvent with password', () => {
            const { store, listeners } = setupStoreWithWebSocket();

            listeners['.game.settings_changed']({
                password_changed: true,
                new_password: 'secret123',
                changed_by: 'Alice',
            });

            expect(store.lastSettingsEvent).not.toBeNull();
            expect(store.lastSettingsEvent.changes).toContainEqual({ type: 'password_changed', password: 'secret123' });
        });

        it('.game.settings_changed does NOT set lastSettingsEvent when no relevant changes', () => {
            const { store, listeners } = setupStoreWithWebSocket();

            listeners['.game.settings_changed']({
                settings: { chat_enabled: true, max_players: 10 },
            });

            expect(store.lastSettingsEvent).toBeNull();
        });
    });

    describe('addBot', () => {
        it('adds player to local list', async () => {
            const botPlayer = { id: 'bot-1', nickname: 'Bot 1', is_bot: true };
            api.games.addBot.mockResolvedValue({ data: { player: botPlayer } });

            const store = useGameStore();
            store.players = [{ id: 'p1', nickname: 'Alice' }];

            await store.addBot('BOTGAM');

            expect(api.games.addBot).toHaveBeenCalledWith('BOTGAM');
            expect(store.players).toContainEqual(botPlayer);
            expect(store.players).toHaveLength(2);
        });

        it('does not add duplicate bot player', async () => {
            const botPlayer = { id: 'bot-1', nickname: 'Bot 1', is_bot: true };
            api.games.addBot.mockResolvedValue({ data: { player: botPlayer } });

            const store = useGameStore();
            store.players = [{ id: 'bot-1', nickname: 'Bot 1', is_bot: true }];

            await store.addBot('BOTGAM');

            expect(store.players).toHaveLength(1);
        });
    });

    describe('removeBot', () => {
        it('removes player from local list', async () => {
            api.games.removeBot.mockResolvedValue({ data: { player_id: 'bot-1' } });

            const store = useGameStore();
            store.players = [
                { id: 'p1', nickname: 'Alice' },
                { id: 'bot-1', nickname: 'Bot 1', is_bot: true },
            ];

            await store.removeBot('BOTGAM', 'bot-1');

            expect(api.games.removeBot).toHaveBeenCalledWith('BOTGAM', 'bot-1');
            expect(store.players).toHaveLength(1);
            expect(store.players[0].id).toBe('p1');
        });
    });

    describe('kickPlayer', () => {
        it('removes player from local list', async () => {
            api.games.kick.mockResolvedValue({ data: { player_id: 'p2' } });

            const store = useGameStore();
            store.players = [
                { id: 'p1', nickname: 'Alice' },
                { id: 'p2', nickname: 'Bob' },
            ];

            await store.kickPlayer('KICKGM', 'p2');

            expect(api.games.kick).toHaveBeenCalledWith('KICKGM', 'p2');
            expect(store.players).toHaveLength(1);
            expect(store.players[0].id).toBe('p1');
        });
    });

    describe('banPlayer', () => {
        it('removes player from local list', async () => {
            api.games.ban.mockResolvedValue({ data: { player_id: 'p2' } });

            const store = useGameStore();
            store.players = [
                { id: 'p1', nickname: 'Alice' },
                { id: 'p2', nickname: 'Bob' },
            ];

            await store.banPlayer('BANGAM', 'p2', 'cheating');

            expect(api.games.ban).toHaveBeenCalledWith('BANGAM', 'p2', 'cheating');
            expect(store.players).toHaveLength(1);
            expect(store.players[0].id).toBe('p1');
        });
    });

    describe('markReady', () => {
        it('calls API and updates readyCount and totalPlayersForReady', async () => {
            api.rounds.markReady.mockResolvedValue({ data: { ready_count: 3, total_players: 5 } });

            const store = useGameStore();

            const result = await store.markReady('round-1', true);

            expect(api.rounds.markReady).toHaveBeenCalledWith('round-1', true);
            expect(store.readyCount).toBe(3);
            expect(store.totalPlayersForReady).toBe(5);
            expect(result).toEqual({ ready_count: 3, total_players: 5 });
        });
    });

    describe('retractVote', () => {
        it('calls API and clears myVote', async () => {
            api.rounds.retractVote.mockResolvedValue({});

            const store = useGameStore();
            store.myVote = { id: 'v1', answer_id: 'a1' };

            await store.retractVote('round-1');

            expect(api.rounds.retractVote).toHaveBeenCalledWith('round-1');
            expect(store.myVote).toBeNull();
        });
    });
});
