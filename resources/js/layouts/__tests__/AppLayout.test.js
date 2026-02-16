import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, reactive, computed } from 'vue';
import AppLayout from '../AppLayout.vue';

const mockAuthStore = reactive({
    isAuthenticated: true,
    isGuest: false,
    isAdmin: false,
    nickname: 'TestUser',
    player: { nickname: 'TestUser' },
    user: { email: 'test@test.com', name: 'Test', gravatar_url: null },
    isInitialized: true,
    loadFromStorage: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
});

vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => mockAuthStore,
}));

vi.mock('pinia', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        storeToRefs: (store) => ({
            isAuthenticated: computed(() => store.isAuthenticated),
            isGuest: computed(() => store.isGuest),
            isAdmin: computed(() => store.isAdmin),
            nickname: computed(() => store.nickname),
        }),
    };
});

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: vi.fn(),
        locale: { value: 'no' },
        isNorwegian: { value: true },
    }),
}));

const mockToggleDark = vi.fn();
vi.mock('../../composables/useDarkMode.js', () => ({
    useDarkMode: () => ({
        isDark: ref(false),
        toggleDark: mockToggleDark,
    }),
}));

vi.mock('../../services/api.js', () => ({
    api: {
        profile: { updateNickname: vi.fn() },
    },
}));

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

import { router } from '@inertiajs/vue3';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: { template: '<input />', inheritAttrs: false },
    Toast: { template: '<div class="toast" />' },
    ConfirmDialog: { template: '<div />' },
    Dialog: {
        template: '<div v-if="$attrs.visible !== false"><slot /><slot name="footer" /></div>',
        inheritAttrs: false,
    },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    Transition: { template: '<div><slot /></div>' },
};

function mountAppLayout(options = {}) {
    return mount(AppLayout, {
        global: { stubs },
        slots: options.slots || {},
        ...options,
    });
}

describe('AppLayout.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = false;
        mockAuthStore.isAdmin = false;
        mockAuthStore.nickname = 'TestUser';
        mockAuthStore.player = { nickname: 'TestUser' };
        mockAuthStore.user = { email: 'test@test.com', name: 'Test', gravatar_url: null };
        mockAuthStore.isInitialized = true;
        mockAuthStore.logout.mockResolvedValue(undefined);
    });

    it('renders SELECT logo link', () => {
        const wrapper = mountAppLayout();

        const logoLink = wrapper.findAll('a').find((a) => a.text().includes('SELECT'));
        expect(logoLink).toBeTruthy();
        expect(logoLink.attributes('href')).toBe('/');
    });

    it('shows nav links for authenticated user', () => {
        const wrapper = mountAppLayout();

        expect(wrapper.text()).toContain('nav.play');
        expect(wrapper.text()).toContain('nav.archive');
        expect(wrapper.text()).toContain('nav.hallOfFame');
        expect(wrapper.text()).toContain('nav.leaderboard');
    });

    it('shows Play link only when authenticated', () => {
        mockAuthStore.isAuthenticated = false;

        const wrapper = mountAppLayout();

        // Desktop nav links (hidden sm:flex)
        const desktopNav = wrapper.find('.hidden.sm\\:flex');
        if (desktopNav.exists()) {
            const links = desktopNav.findAll('a');
            const playLink = links.find((l) => l.text() === 'nav.play');
            expect(playLink).toBeUndefined();
        }
    });

    it('shows menu toggle button', () => {
        const wrapper = mountAppLayout();

        const menuButton = wrapper.findAll('button').find((btn) => {
            return btn.find('svg').exists() && btn.classes().some((c) => c.includes('rounded'));
        });
        expect(menuButton).toBeTruthy();
    });

    it('guest banner visible for authenticated guest', () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = true;

        const wrapper = mountAppLayout();

        expect(wrapper.text()).toContain('guest.banner');
        expect(wrapper.text()).toContain('guest.createAccount');
    });

    it('guest banner hidden for non-guest', () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = false;

        const wrapper = mountAppLayout();

        expect(wrapper.text()).not.toContain('guest.banner');
    });

    it('guest banner hidden when not authenticated', () => {
        mockAuthStore.isAuthenticated = false;
        mockAuthStore.isGuest = false;

        const wrapper = mountAppLayout();

        expect(wrapper.text()).not.toContain('guest.banner');
    });

    it('menu dropdown toggles on button click', async () => {
        const wrapper = mountAppLayout();

        // Initially the settings row (language/dark mode buttons) should not be visible
        expect(wrapper.text()).not.toContain('nav.language');

        // Find and click the menu toggle button (the one with border and rounded)
        const menuButtons = wrapper.findAll('button').filter((btn) => {
            const classes = btn.attributes('class') || '';
            return classes.includes('rounded') && classes.includes('border');
        });
        expect(menuButtons.length).toBeGreaterThan(0);
        await menuButtons[0].trigger('click');

        // Dropdown should now be visible with language and dark mode buttons
        expect(wrapper.text()).toContain('nav.language');
        expect(wrapper.text()).toContain('nav.darkMode');
    });

    it('shows nickname in nav for non-guest user', () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = false;
        mockAuthStore.nickname = 'PlayerOne';

        const wrapper = mountAppLayout();

        expect(wrapper.text()).toContain('PlayerOne');
    });

    it('shows nickname as clickable button for guest user', () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = true;
        mockAuthStore.nickname = 'GuestPlayer';

        const wrapper = mountAppLayout();

        const nicknameButton = wrapper.findAll('button').find((btn) => btn.text().includes('GuestPlayer'));
        expect(nicknameButton).toBeTruthy();
    });

    it('slot content is rendered in main', () => {
        const wrapper = mountAppLayout({
            slots: {
                default: '<div class="page-content">Hello World</div>',
            },
        });

        expect(wrapper.find('.page-content').exists()).toBe(true);
        expect(wrapper.text()).toContain('Hello World');
    });

    it('renders footer with tagline', () => {
        const wrapper = mountAppLayout();

        expect(wrapper.find('footer').exists()).toBe(true);
        expect(wrapper.text()).toContain('footer.tagline');
    });

    it('shows logout button for authenticated non-guest in dropdown', async () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = false;

        const wrapper = mountAppLayout();

        // Open menu
        const menuButtons = wrapper.findAll('button').filter((btn) => {
            const classes = btn.attributes('class') || '';
            return classes.includes('rounded') && classes.includes('border');
        });
        await menuButtons[0].trigger('click');

        expect(wrapper.text()).toContain('nav.logout');
        expect(wrapper.text()).toContain('nav.settings');
    });

    it('shows create account and change nickname for guest in dropdown', async () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = true;

        const wrapper = mountAppLayout();

        // Open menu
        const menuButtons = wrapper.findAll('button').filter((btn) => {
            const classes = btn.attributes('class') || '';
            return classes.includes('rounded') && classes.includes('border');
        });
        await menuButtons[0].trigger('click');

        expect(wrapper.text()).toContain('guest.changeNickname');
        expect(wrapper.text()).toContain('nav.createAccount');
    });

    it('shows login and register for unauthenticated in dropdown', async () => {
        mockAuthStore.isAuthenticated = false;

        const wrapper = mountAppLayout();

        // Open menu
        const menuButtons = wrapper.findAll('button').filter((btn) => {
            const classes = btn.attributes('class') || '';
            return classes.includes('rounded') && classes.includes('border');
        });
        await menuButtons[0].trigger('click');

        expect(wrapper.text()).toContain('nav.login');
        expect(wrapper.text()).toContain('nav.register');
    });

    it('calls logout and redirects on handleLogout', async () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = false;

        const wrapper = mountAppLayout();

        // Open menu
        const menuButtons = wrapper.findAll('button').filter((btn) => {
            const classes = btn.attributes('class') || '';
            return classes.includes('rounded') && classes.includes('border');
        });
        await menuButtons[0].trigger('click');

        // Click logout button
        const logoutBtn = wrapper.findAll('button').find((btn) => btn.text().includes('nav.logout'));
        expect(logoutBtn).toBeTruthy();
        await logoutBtn.trigger('click');

        await vi.waitFor(() => {
            expect(mockAuthStore.logout).toHaveBeenCalled();
        });
        expect(router.visit).toHaveBeenCalledWith('/');
    });
});
