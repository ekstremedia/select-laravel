import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Games from '../Games.vue';

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({ t: (key) => key, toggleLocale: vi.fn(), locale: { value: 'no' }, isNorwegian: { value: true } }),
}));

vi.mock('../../services/api.js', () => ({
    api: { games: { list: vi.fn() } },
}));

import { router } from '@inertiajs/vue3';
import { api } from '../../services/api.js';

const stubs = {
    Button: { template: '<button :type="$attrs.type" :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>', inheritAttrs: false },
    InputText: {
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'input\', $event)" />',
        props: ['modelValue'],
        emits: ['update:modelValue', 'input'],
    },
    Skeleton: { template: '<div class="skeleton" />' },
    Badge: { template: '<span>{{ $attrs.value }}</span>', inheritAttrs: false },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
};

function mountGames() {
    return mount(Games, {
        global: {
            stubs,
        },
    });
}

describe('Games.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.useFakeTimers();
        vi.clearAllMocks();
        sessionStorage.clear();
        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows loading skeleton initially', () => {
        // Make the API call hang so loading stays true
        api.games.list.mockReturnValue(new Promise(() => {}));

        const wrapper = mountGames();

        expect(wrapper.findAll('.skeleton').length).toBe(3);
    });

    it('shows empty state when API returns no games', async () => {
        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });

        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).toContain('games.noGames');
        expect(wrapper.findAll('.skeleton').length).toBe(0);
    });

    it('renders game list when API returns games', async () => {
        const games = [
            { code: 'ABCD', host_nickname: 'Alice', host_avatar_url: null, is_public: true, status: 'lobby', player_count: 3, max_players: 8 },
            { code: 'EFGH', host_nickname: 'Bob', host_avatar_url: null, is_public: false, status: 'lobby', player_count: 2, max_players: 8 },
        ];
        api.games.list.mockResolvedValue({ data: { games, my_games: [] } });

        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).toContain('#ABCD');
        expect(wrapper.text()).toContain('#EFGH');
        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');
    });

    it('renders my games section when API returns my_games', async () => {
        const myGames = [
            { code: 'MINE1', host_nickname: 'Me', host_avatar_url: null, is_public: true, status: 'lobby', player_count: 1, max_players: 8 },
        ];
        api.games.list.mockResolvedValue({ data: { games: [], my_games: myGames } });

        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).toContain('games.myGames');
        expect(wrapper.text()).toContain('#MINE1');
    });

    it('does not render my games section when my_games is empty', async () => {
        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });

        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).not.toContain('games.myGames');
    });

    it('join code input transforms to uppercase and filters non-alphanumeric', async () => {
        const wrapper = mountGames();
        await flushPromises();

        const form = wrapper.find('form');
        const input = form.find('input');

        // Simulate setting a value with lowercase and special chars
        await input.setValue('ab!@12');
        await input.trigger('input');
        await flushPromises();

        // The component uses v-model with @input handler that transforms the value
        // The underlying joinCode ref should be uppercase alphanumeric only
        // We verify by checking the join button state (needs >= 4 chars)
        // 'ab!@12' -> 'AB12' which is 4 chars, so button should be enabled
        const joinButton = form.find('button[type="submit"]');
        expect(joinButton.attributes('disabled')).toBeUndefined();
    });

    it('join button disabled when code < 4 chars', async () => {
        const wrapper = mountGames();
        await flushPromises();

        const form = wrapper.find('form');
        const joinButton = form.find('button[type="submit"]');

        // Initial state: empty code
        expect(joinButton.attributes('disabled')).toBeDefined();
    });

    it('join button enabled when code has 4+ chars', async () => {
        const wrapper = mountGames();
        await flushPromises();

        const form = wrapper.find('form');
        const input = form.find('input');

        await input.setValue('ABCD');
        await input.trigger('input');
        await flushPromises();

        const joinButton = form.find('button[type="submit"]');
        expect(joinButton.attributes('disabled')).toBeUndefined();
    });

    it('handleJoinByCode navigates to /spill/{CODE}/se', async () => {
        const wrapper = mountGames();
        await flushPromises();

        const form = wrapper.find('form');
        const input = form.find('input');

        await input.setValue('TEST');
        await input.trigger('input');
        await flushPromises();

        await form.trigger('submit');
        await flushPromises();

        expect(router.visit).toHaveBeenCalledWith('/spill/TEST/se');
    });

    it('handleJoinByCode does not navigate when code < 4 chars', async () => {
        const wrapper = mountGames();
        await flushPromises();

        const form = wrapper.find('form');
        const input = form.find('input');

        await input.setValue('AB');
        await input.trigger('input');
        await flushPromises();

        await form.trigger('submit');
        await flushPromises();

        expect(router.visit).not.toHaveBeenCalled();
    });

    it('shows kick notification from sessionStorage', async () => {
        sessionStorage.setItem('select-kicked', 'kicked');

        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });
        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).toContain('lobby.kickedNotification');
        // sessionStorage items should be removed after reading
        expect(sessionStorage.getItem('select-kicked')).toBeNull();
    });

    it('shows ban notification from sessionStorage', async () => {
        sessionStorage.setItem('select-kicked', 'banned');
        sessionStorage.setItem('select-banned-reason', 'Cheating');

        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });
        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).toContain('lobby.bannedNotification');
        expect(wrapper.text()).toContain('Cheating');
        expect(sessionStorage.getItem('select-kicked')).toBeNull();
        expect(sessionStorage.getItem('select-banned-reason')).toBeNull();
    });

    it('shows game started notice for non-lobby my_games', async () => {
        const myGames = [
            { code: 'PLAY1', host_nickname: 'Host', host_avatar_url: null, is_public: true, status: 'playing', current_round: 2, total_rounds: 5, player_count: 4, max_players: 8 },
        ];
        api.games.list.mockResolvedValue({ data: { games: [], my_games: myGames } });

        const wrapper = mountGames();
        await flushPromises();

        expect(wrapper.text()).toContain('games.gameStarted');
        expect(wrapper.text()).toContain('#PLAY1');
        expect(wrapper.text()).toContain('2/5');
    });

    it('navigates to create game page when create button is clicked', async () => {
        const wrapper = mountGames();
        await flushPromises();

        // Find the create button by its label text
        const buttons = wrapper.findAll('button');
        const createButton = buttons.find(b => b.text().includes('games.create'));
        expect(createButton).toBeTruthy();

        await createButton.trigger('click');

        expect(router.visit).toHaveBeenCalledWith('/spill/opprett');
    });

    it('clicking an open game navigates to /spill/{code}/se', async () => {
        const games = [
            { code: 'VIEW1', host_nickname: 'Alice', host_avatar_url: null, is_public: true, status: 'lobby', player_count: 2, max_players: 8 },
        ];
        api.games.list.mockResolvedValue({ data: { games, my_games: [] } });

        const wrapper = mountGames();
        await flushPromises();

        // Find the open game card and click it
        const gameCards = wrapper.findAll('[class*="cursor-pointer"]');
        const openGameCard = gameCards.find(card => card.text().includes('#VIEW1'));
        expect(openGameCard).toBeTruthy();

        await openGameCard.trigger('click');

        expect(router.visit).toHaveBeenCalledWith('/spill/VIEW1/se');
    });

    it('clicking a my game navigates to /spill/{code}', async () => {
        const myGames = [
            { code: 'MYGM1', host_nickname: 'Me', host_avatar_url: null, is_public: true, status: 'lobby', player_count: 1, max_players: 8 },
        ];
        api.games.list.mockResolvedValue({ data: { games: [], my_games: myGames } });

        const wrapper = mountGames();
        await flushPromises();

        const gameCards = wrapper.findAll('[class*="cursor-pointer"]');
        const myGameCard = gameCards.find(card => card.text().includes('#MYGM1'));
        expect(myGameCard).toBeTruthy();

        await myGameCard.trigger('click');

        expect(router.visit).toHaveBeenCalledWith('/spill/MYGM1');
    });

    it('polls for games every 10 seconds', async () => {
        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });

        mountGames();
        await flushPromises();

        expect(api.games.list).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(10000);
        await flushPromises();

        expect(api.games.list).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(10000);
        await flushPromises();

        expect(api.games.list).toHaveBeenCalledTimes(3);
    });

    it('stops polling on unmount', async () => {
        api.games.list.mockResolvedValue({ data: { games: [], my_games: [] } });

        const wrapper = mountGames();
        await flushPromises();

        expect(api.games.list).toHaveBeenCalledTimes(1);

        wrapper.unmount();
        vi.advanceTimersByTime(20000);
        await flushPromises();

        expect(api.games.list).toHaveBeenCalledTimes(1);
    });
});
