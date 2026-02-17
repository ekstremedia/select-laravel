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
        hallOfFame: {
            list: vi.fn(),
            random: vi.fn(),
        },
    },
}));

import HallOfFame from '../HallOfFame.vue';
import { api } from '../../services/api.js';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    Skeleton: { template: '<div class="skeleton" />' },
    Badge: { template: '<span>{{ $attrs.value }}</span>', inheritAttrs: false },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

const sampleSentences = [
    { id: 1, acronym: 'LOL', text: 'Laughing Out Loud', player_nickname: 'Alice', avatar_url: null, votes_count: 5, game_code: 'G001' },
    { id: 2, acronym: 'BRB', text: 'Be Right Back', player_nickname: 'Bob', avatar_url: null, votes_count: 3, game_code: 'G002' },
];

const sampleClassic = {
    gullkorn: { setning: 'En klassisk setning', nick: 'OldTimer', stemmer: 42 },
};

function mountHallOfFame() {
    return mount(HallOfFame, {
        global: { stubs },
    });
}

describe('HallOfFame', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('shows loading state initially', () => {
        api.hallOfFame.list.mockReturnValue(new Promise(() => {}));
        api.hallOfFame.random.mockReturnValue(new Promise(() => {}));

        const wrapper = mountHallOfFame();

        expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders sentence cards after load', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: sampleSentences, meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        expect(wrapper.text()).toContain('LOL');
        expect(wrapper.text()).toContain('BRB');
        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');
    });

    it('renders votes count in sentence cards', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: sampleSentences, meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        // Badge renders the value; votes_count is displayed via Badge
        expect(wrapper.text()).toContain('5');
        expect(wrapper.text()).toContain('3');
    });

    it('shows empty state when no sentences', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: [], meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        expect(wrapper.text()).toContain('hallOfFame.noSentences');
    });

    it('classic section shows random sentence', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: sampleSentences, meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        expect(wrapper.text()).toContain('En klassisk setning');
        expect(wrapper.text()).toContain('OldTimer');
        expect(wrapper.text()).toContain('42');
    });

    it('classic section shows heading', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: [], meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        expect(wrapper.text()).toContain('hallOfFame.classic');
    });

    it('changePeriod resets and reloads', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: [], meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        // Initial load called list once
        expect(api.hallOfFame.list).toHaveBeenCalledTimes(1);

        const buttons = wrapper.findAll('button');
        const monthButton = buttons.find((b) => b.text().includes('archive.thisMonth'));
        expect(monthButton).toBeTruthy();

        await monthButton.trigger('click');
        await flushPromises();

        expect(api.hallOfFame.list).toHaveBeenCalledTimes(2);
        expect(api.hallOfFame.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 1, period: 'month' }),
        );
    });

    it('load more increments page', async () => {
        api.hallOfFame.list
            .mockResolvedValueOnce({
                data: { sentences: sampleSentences, meta: { has_more: true } },
            })
            .mockResolvedValueOnce({
                data: {
                    sentences: [
                        { id: 3, acronym: 'GG', text: 'Good Game', player_nickname: 'Carl', avatar_url: null, votes_count: 1, game_code: 'G003' },
                    ],
                    meta: { has_more: false },
                },
            });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const loadMoreButton = buttons.find((b) => b.text().includes('archive.loadMore'));
        expect(loadMoreButton).toBeTruthy();

        await loadMoreButton.trigger('click');
        await flushPromises();

        expect(api.hallOfFame.list).toHaveBeenCalledTimes(2);
        expect(api.hallOfFame.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 2 }),
        );
    });

    it('does not show load more when hasMore is false', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: sampleSentences, meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const loadMoreButton = buttons.find((b) => b.text().includes('archive.loadMore'));
        expect(loadMoreButton).toBeUndefined();
    });

    it('renders period filter buttons', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: [], meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const periodLabels = ['archive.allTime', 'archive.thisMonth', 'archive.thisWeek'];
        for (const label of periodLabels) {
            expect(buttons.some((b) => b.text().includes(label))).toBe(true);
        }
    });

    it('shuffle button reloads classic sentence', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: [], meta: { has_more: false } },
        });
        api.hallOfFame.random
            .mockResolvedValueOnce({ data: sampleClassic })
            .mockResolvedValueOnce({
                data: { gullkorn: { setning: 'En ny setning', nick: 'NewUser', stemmer: 7 } },
            });

        const wrapper = mountHallOfFame();
        await flushPromises();

        expect(wrapper.text()).toContain('En klassisk setning');
        expect(api.hallOfFame.random).toHaveBeenCalledTimes(1);

        const buttons = wrapper.findAll('button');
        const shuffleButton = buttons.find((b) => b.text().includes('hallOfFame.shuffle'));
        expect(shuffleButton).toBeTruthy();

        await shuffleButton.trigger('click');
        await flushPromises();

        expect(api.hallOfFame.random).toHaveBeenCalledTimes(2);
        expect(wrapper.text()).toContain('En ny setning');
        expect(wrapper.text()).toContain('NewUser');
    });

    it('renders game code links on sentence cards', async () => {
        api.hallOfFame.list.mockResolvedValue({
            data: { sentences: sampleSentences, meta: { has_more: false } },
        });
        api.hallOfFame.random.mockResolvedValue({ data: sampleClassic });

        const wrapper = mountHallOfFame();
        await flushPromises();

        const gameLinks = wrapper.findAll('a').filter((a) => a.attributes('href')?.startsWith('/arkiv/'));
        expect(gameLinks.length).toBeGreaterThanOrEqual(2);
    });
});
