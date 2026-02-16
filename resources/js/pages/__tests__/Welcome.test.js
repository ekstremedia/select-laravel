import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: { gullkorn: 'Slippery Eels Like Eating Curry Tonight' }, url: '/' })),
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: vi.fn(),
        isNorwegian: { value: true },
    }),
}));

vi.mock('../../composables/useDarkMode.js', () => ({
    useDarkMode: () => ({
        isDark: { value: false },
        toggleDark: vi.fn(),
    }),
}));

vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => ({
        isInitialized: true,
        loadFromStorage: vi.fn(),
    }),
}));

vi.mock('../../services/api.js', () => ({
    api: {
        hallOfFame: {
            random: vi.fn().mockResolvedValue({ data: { sentence: { text: 'Hello World' } } }),
        },
        stats: vi.fn().mockResolvedValue({
            data: { games_played: 42, total_sentences: 100, active_players: 5 },
        }),
    },
}));

import Welcome from '../Welcome.vue';
import { router } from '@inertiajs/vue3';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
};

function mountWelcome() {
    return mount(Welcome, {
        global: { stubs },
    });
}

describe('Welcome.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders SELECT title', () => {
        const wrapper = mountWelcome();

        expect(wrapper.find('h1').text()).toBe('SELECT');
    });

    it('renders hero subtitle translation key', () => {
        const wrapper = mountWelcome();

        expect(wrapper.text()).toContain('hero.subtitle');
    });

    it('renders "how it works" section with 4 steps', () => {
        const wrapper = mountWelcome();

        expect(wrapper.text()).toContain('how.title');
        for (let step = 1; step <= 4; step++) {
            expect(wrapper.text()).toContain(`how.step${step}.title`);
            expect(wrapper.text()).toContain(`how.step${step}.desc`);
        }
    });

    it('CTA button text uses translation key', () => {
        const wrapper = mountWelcome();

        const buttons = wrapper.findAll('button');
        const ctaButton = buttons.find((b) => b.text().includes('cta.play'));
        expect(ctaButton).toBeTruthy();
    });

    it('stats section renders when stats loaded', async () => {
        vi.useRealTimers();
        const wrapper = mountWelcome();
        await flushPromises();

        expect(wrapper.text()).toContain('42');
        expect(wrapper.text()).toContain('100');
        expect(wrapper.text()).toContain('5');
        expect(wrapper.text()).toContain('stats.gamesPlayed');
        expect(wrapper.text()).toContain('stats.sentences');
        expect(wrapper.text()).toContain('stats.activePlayers');
    });

    it('language toggle button exists', () => {
        const wrapper = mountWelcome();

        const navButtons = wrapper.findAll('nav button');
        const langButton = navButtons.find((b) => b.text().includes('nav.language'));
        expect(langButton).toBeTruthy();
    });

    it('dark mode toggle button exists', () => {
        const wrapper = mountWelcome();

        const navButtons = wrapper.findAll('nav button');
        // There should be at least 2 buttons in nav: language and dark mode
        expect(navButtons.length).toBeGreaterThanOrEqual(2);
        // The dark mode button has an SVG inside it
        const darkModeButton = navButtons.find((b) => b.find('svg').exists());
        expect(darkModeButton).toBeTruthy();
    });
});
