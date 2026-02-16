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
            get: vi.fn(),
            round: vi.fn(),
        },
    },
}));

import ArchiveGame from '../ArchiveGame.vue';
import { api } from '../../services/api.js';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    Skeleton: { template: '<div class="skeleton" />' },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

const sampleGameData = {
    game: {
        code: 'TEST1',
        finished_at: '2025-03-15T10:00:00Z',
    },
    players: [
        { player_id: 1, nickname: 'Alice', score: 15, is_winner: true },
        { player_id: 2, nickname: 'Bob', score: 10, is_winner: false },
        { player_id: 3, nickname: 'Carl', score: 5, is_winner: false },
    ],
    rounds: [
        {
            round_number: 1,
            acronym: 'ABC',
            answers: [
                { id: 1, text: 'Always Be Coding', player_name: 'Alice', votes_count: 3, voters: ['Bob', 'Carl'] },
                { id: 2, text: 'Another Big Cat', player_name: 'Bob', votes_count: 1, voters: ['Alice'] },
            ],
        },
        {
            round_number: 2,
            acronym: 'DEF',
            answers: [
                { id: 3, text: 'Doing Everything Fine', player_name: 'Carl', votes_count: 2, voters: ['Alice'] },
            ],
        },
    ],
};

function mountArchiveGame(props = {}) {
    return mount(ArchiveGame, {
        props: { code: 'TEST1', ...props },
        global: { stubs },
    });
}

describe('ArchiveGame', () => {
    let originalClipboard;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        originalClipboard = navigator.clipboard;
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: originalClipboard,
            writable: true,
            configurable: true,
        });
    });

    it('shows loading state initially', () => {
        api.archive.get.mockReturnValue(new Promise(() => {}));

        const wrapper = mountArchiveGame();

        expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders game code and standings after load', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        expect(wrapper.text()).toContain('#TEST1');
        expect(wrapper.text()).toContain('Alice');
        expect(wrapper.text()).toContain('Bob');
        expect(wrapper.text()).toContain('Carl');
        expect(wrapper.text()).toContain('15');
        expect(wrapper.text()).toContain('10');
        expect(wrapper.text()).toContain('5');
    });

    it('renders final standings heading', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        expect(wrapper.text()).toContain('archive.finalStandings');
    });

    it('shows error state on 404', async () => {
        api.archive.get.mockRejectedValue({
            response: { status: 404 },
        });

        const wrapper = mountArchiveGame();
        await flushPromises();

        expect(wrapper.text()).toContain('common.notFound');
        expect(wrapper.findAll('.skeleton')).toHaveLength(0);
    });

    it('shows generic error on non-404 failures', async () => {
        api.archive.get.mockRejectedValue({
            response: { status: 500 },
        });

        const wrapper = mountArchiveGame();
        await flushPromises();

        expect(wrapper.text()).toContain('common.error');
    });

    it('shows retry button on error', async () => {
        api.archive.get.mockRejectedValue({
            response: { status: 500 },
        });

        const wrapper = mountArchiveGame();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const retryButton = buttons.find((b) => b.text().includes('common.retry'));
        expect(retryButton).toBeTruthy();
    });

    it('toggleRound removes round from expandedRounds when already expanded', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        // Rounds are auto-expanded on load; round 1 answers should be visible
        expect(wrapper.text()).toContain('always be coding');

        // Click round 1 header to collapse it
        const roundButtons = wrapper.findAll('button');
        const round1Button = roundButtons.find((b) => b.text().includes('ABC'));
        expect(round1Button).toBeTruthy();

        await round1Button.trigger('click');
        await flushPromises();

        // After collapsing, round 1 answers should not be visible
        expect(wrapper.text()).not.toContain('always be coding');
    });

    it('toggleRound re-expands a collapsed round', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        const roundButtons = wrapper.findAll('button');
        const round1Button = roundButtons.find((b) => b.text().includes('ABC'));

        // Collapse
        await round1Button.trigger('click');
        await flushPromises();
        expect(wrapper.text()).not.toContain('always be coding');

        // Re-expand
        await round1Button.trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('always be coding');
    });

    it('shareGame copies URL to clipboard', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            writable: true,
            configurable: true,
        });

        const wrapper = mountArchiveGame();
        await flushPromises();

        const buttons = wrapper.findAll('button');
        const shareButton = buttons.find((b) => b.text().includes('archive.shareGame'));
        expect(shareButton).toBeTruthy();

        await shareButton.trigger('click');
        await flushPromises();

        expect(writeTextMock).toHaveBeenCalledWith(
            expect.stringContaining('/arkiv/TEST1'),
        );
    });

    it('renders back to archive link', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        const backLink = wrapper.find('a[href="/arkiv"]');
        expect(backLink.exists()).toBe(true);
        expect(backLink.text()).toContain('archive.backToArchive');
    });

    it('renders round acronyms', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        expect(wrapper.text()).toContain('ABC');
        expect(wrapper.text()).toContain('DEF');
    });

    it('renders voter names in answers', async () => {
        api.archive.get.mockResolvedValue({ data: sampleGameData });

        const wrapper = mountArchiveGame();
        await flushPromises();

        expect(wrapper.text()).toContain('Bob');
        expect(wrapper.text()).toContain('Carl');
    });
});
