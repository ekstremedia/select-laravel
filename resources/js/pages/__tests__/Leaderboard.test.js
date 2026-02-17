import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

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

vi.mock('../../services/api.js', () => ({
    api: {
        leaderboard: {
            get: vi.fn(),
        },
    },
}));

import Leaderboard from '../Leaderboard.vue';
import { api } from '../../services/api.js';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    Skeleton: { template: '<div class="skeleton" />' },
    DataTable: { template: '<table><slot /></table>', inheritAttrs: false },
    Column: { template: '<td />', inheritAttrs: false },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

const sampleLeaderboard = [
    { nickname: 'Alice', avatar_url: null, games_played: 20, games_won: 12, win_rate: '60%', rounds_won: 45, rank: 1 },
    { nickname: 'Bob', avatar_url: null, games_played: 18, games_won: 8, win_rate: '44%', rounds_won: 30, rank: 2 },
    { nickname: 'Carl', avatar_url: null, games_played: 15, games_won: 5, win_rate: '33%', rounds_won: 20, rank: 3 },
];

function mountLeaderboard() {
    return mount(Leaderboard, {
        global: { stubs },
    });
}

describe('Leaderboard', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('shows loading state initially', () => {
        api.leaderboard.get.mockReturnValue(new Promise(() => {}));

        const wrapper = mountLeaderboard();

        expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders leaderboard data after load', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: sampleLeaderboard },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        // DataTable is stubbed as a <table>, so it won't render row data.
        // But the loading skeletons should be gone.
        expect(wrapper.findAll('.skeleton')).toHaveLength(0);
        // DataTable should be present
        expect(wrapper.find('table').exists()).toBe(true);
    });

    it('shows empty state when no data', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: [] },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        expect(wrapper.text()).toContain('archive.noGames');
    });

    it('does not show empty state when data exists', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: sampleLeaderboard },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        expect(wrapper.text()).not.toContain('archive.noGames');
    });

    it('changePeriod reloads data', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: sampleLeaderboard },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        expect(api.leaderboard.get).toHaveBeenCalledTimes(1);

        const buttons = wrapper.findAll('button');
        const monthButton = buttons.find((b) => b.text().includes('archive.thisMonth'));
        expect(monthButton).toBeTruthy();

        await monthButton.trigger('click');
        await flushPromises();

        expect(api.leaderboard.get).toHaveBeenCalledTimes(2);
        expect(api.leaderboard.get).toHaveBeenLastCalledWith(
            expect.objectContaining({ period: 'month' }),
        );
    });

    it('changePeriod to week sends correct period', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: sampleLeaderboard },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const weekButton = buttons.find((b) => b.text().includes('archive.thisWeek'));
        expect(weekButton).toBeTruthy();

        await weekButton.trigger('click');
        await flushPromises();

        expect(api.leaderboard.get).toHaveBeenLastCalledWith(
            expect.objectContaining({ period: 'week' }),
        );
    });

    it('changePeriod to all sends undefined period', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: sampleLeaderboard },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        // First switch to month
        const buttons = wrapper.findAll('button');
        const monthButton = buttons.find((b) => b.text().includes('archive.thisMonth'));
        await monthButton.trigger('click');
        await flushPromises();

        // Then switch back to all
        const allButtons = wrapper.findAll('button');
        const allButton = allButtons.find((b) => b.text().includes('archive.allTime'));
        await allButton.trigger('click');
        await flushPromises();

        expect(api.leaderboard.get).toHaveBeenLastCalledWith(
            expect.objectContaining({ period: undefined }),
        );
    });

    it('renders period filter buttons', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: [] },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const periodLabels = ['archive.allTime', 'archive.thisMonth', 'archive.thisWeek'];
        for (const label of periodLabels) {
            expect(buttons.some((b) => b.text().includes(label))).toBe(true);
        }
    });

    it('renders page title', async () => {
        api.leaderboard.get.mockResolvedValue({
            data: { leaderboard: [] },
        });

        const wrapper = mountLeaderboard();
        await flushPromises();

        expect(wrapper.text()).toContain('leaderboard.title');
    });

    it('sets leaderboard to empty array on API error', async () => {
        api.leaderboard.get.mockRejectedValue(new Error('Network Error'));

        const wrapper = mountLeaderboard();
        await flushPromises();

        // Should show empty state since leaderboard is []
        expect(wrapper.text()).toContain('archive.noGames');
        expect(wrapper.findAll('.skeleton')).toHaveLength(0);
    });
});
