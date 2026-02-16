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
        archive: {
            list: vi.fn(),
        },
    },
}));

import Archive from '../Archive.vue';
import { api } from '../../services/api.js';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: { template: '<input />', inheritAttrs: false },
    Skeleton: { template: '<div class="skeleton" />' },
    Badge: { template: '<span>{{ $attrs.value }}</span>', inheritAttrs: false },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

function mountArchive() {
    return mount(Archive, {
        global: { stubs },
    });
}

describe('Archive', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('shows loading state initially', () => {
        api.archive.list.mockReturnValue(new Promise(() => {}));

        const wrapper = mountArchive();

        expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders game cards after API resolves', async () => {
        api.archive.list.mockResolvedValue({
            data: {
                games: [
                    { code: 'ABC1', finished_at: '2025-01-01', player_count: 4, winner_nickname: 'Alice', rounds_count: 3 },
                    { code: 'DEF2', finished_at: '2025-01-02', player_count: 3, winner_nickname: 'Bob', rounds_count: 5 },
                ],
                meta: { has_more: false },
            },
        });

        const wrapper = mountArchive();
        await flushPromises();

        const links = wrapper.findAll('a[href]');
        const gameLinks = links.filter((l) => l.attributes('href')?.startsWith('/arkiv/'));
        expect(gameLinks).toHaveLength(2);
        expect(wrapper.text()).toContain('#ABC1');
        expect(wrapper.text()).toContain('#DEF2');
        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');
    });

    it('shows empty state when no games', async () => {
        api.archive.list.mockResolvedValue({
            data: { games: [], meta: { has_more: false } },
        });

        const wrapper = mountArchive();
        await flushPromises();

        expect(wrapper.text()).toContain('archive.noGames');
        expect(wrapper.findAll('.skeleton')).toHaveLength(0);
    });

    it('shows "load more" button when hasMore is true', async () => {
        api.archive.list.mockResolvedValue({
            data: {
                games: [
                    { code: 'XYZ9', finished_at: '2025-02-01', player_count: 2, winner_nickname: 'Carl', rounds_count: 1 },
                ],
                meta: { has_more: true },
            },
        });

        const wrapper = mountArchive();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const loadMoreButton = buttons.find((b) => b.text().includes('archive.loadMore'));
        expect(loadMoreButton).toBeTruthy();
    });

    it('does not show "load more" button when hasMore is false', async () => {
        api.archive.list.mockResolvedValue({
            data: {
                games: [
                    { code: 'XYZ9', finished_at: '2025-02-01', player_count: 2, winner_nickname: 'Carl', rounds_count: 1 },
                ],
                meta: { has_more: false },
            },
        });

        const wrapper = mountArchive();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const loadMoreButton = buttons.find((b) => b.text().includes('archive.loadMore'));
        expect(loadMoreButton).toBeUndefined();
    });

    it('changePeriod resets page and reloads', async () => {
        api.archive.list.mockResolvedValue({
            data: { games: [], meta: { has_more: false } },
        });

        const wrapper = mountArchive();
        await flushPromises();

        // Initial load
        expect(api.archive.list).toHaveBeenCalledTimes(1);

        // Click a period button (e.g., "month")
        const buttons = wrapper.findAll('button');
        const monthButton = buttons.find((b) => b.text().includes('archive.thisMonth'));
        expect(monthButton).toBeTruthy();

        await monthButton.trigger('click');
        await flushPromises();

        expect(api.archive.list).toHaveBeenCalledTimes(2);
        expect(api.archive.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 1, period: 'month' }),
        );
    });

    it('renders period filter buttons', async () => {
        api.archive.list.mockResolvedValue({
            data: { games: [], meta: { has_more: false } },
        });

        const wrapper = mountArchive();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const periodLabels = ['archive.allTime', 'archive.thisMonth', 'archive.thisWeek'];
        for (const label of periodLabels) {
            expect(buttons.some((b) => b.text().includes(label))).toBe(true);
        }
    });

    it('load more increments page and appends results', async () => {
        api.archive.list
            .mockResolvedValueOnce({
                data: {
                    games: [{ code: 'AAA1', finished_at: '2025-01-01', player_count: 2, winner_nickname: 'A', rounds_count: 1 }],
                    meta: { has_more: true },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    games: [{ code: 'BBB2', finished_at: '2025-01-02', player_count: 3, winner_nickname: 'B', rounds_count: 2 }],
                    meta: { has_more: false },
                },
            });

        const wrapper = mountArchive();
        await flushPromises();

        expect(wrapper.text()).toContain('#AAA1');

        const buttons = wrapper.findAll('button');
        const loadMoreButton = buttons.find((b) => b.text().includes('archive.loadMore'));
        await loadMoreButton.trigger('click');
        await flushPromises();

        expect(api.archive.list).toHaveBeenCalledTimes(2);
        expect(api.archive.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 2 }),
        );
        expect(wrapper.text()).toContain('#AAA1');
        expect(wrapper.text()).toContain('#BBB2');
    });

    it('renders player filter input', async () => {
        api.archive.list.mockResolvedValue({
            data: { games: [], meta: { has_more: false } },
        });

        const wrapper = mountArchive();
        await flushPromises();

        expect(wrapper.find('input').exists()).toBe(true);
    });
});
