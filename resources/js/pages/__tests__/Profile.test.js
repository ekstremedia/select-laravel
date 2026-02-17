import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import Profile from '../Profile.vue';

const mockAuthStore = reactive({
    isAuthenticated: true,
    isGuest: false,
    isAdmin: false,
    nickname: 'TestUser',
    player: { nickname: 'TestUser' },
    user: { email: 'test@test.com', name: 'Test', gravatar_url: null },
    isInitialized: true,
});

vi.mock('../../stores/authStore.js', () => ({
    useAuthStore: () => mockAuthStore,
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({
        t: (key) => key,
        toggleLocale: vi.fn(),
        locale: { value: 'no' },
        isNorwegian: { value: true },
    }),
}));

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

const mockProfileApi = vi.fn();
const mockSentencesApi = vi.fn();
const mockGamesApi = vi.fn();

vi.mock('../../services/api.js', () => ({
    api: {
        players: {
            profile: (...args) => mockProfileApi(...args),
            sentences: (...args) => mockSentencesApi(...args),
            games: (...args) => mockGamesApi(...args),
        },
    },
}));

const stubs = {
    Button: {
        template: '<button @click="$emit(\'click\')"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    Skeleton: { template: '<div class="skeleton" />' },
    TabView: { template: '<div><slot /></div>' },
    TabPanel: { template: '<div><slot /></div>', props: ['header'] },
    Badge: { template: '<span>{{ $attrs.value }}</span>', inheritAttrs: false },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

function mountProfile(props = {}) {
    return mount(Profile, {
        props: {
            nickname: 'TestUser',
            ...props,
        },
        global: { stubs },
    });
}

const profileData = {
    player: {
        nickname: 'TestUser',
        avatar_url: null,
        is_bot: false,
        is_guest: false,
        member_since: '2024-01-15',
    },
    stats: {
        games_played: 42,
        games_won: 10,
        win_rate: '24%',
        rounds_won: 55,
        votes_received: 120,
    },
};

const sentencesData = {
    sentences: [
        { id: 1, acronym: 'ABC', text: 'A BIG CAT', votes_count: 5 },
        { id: 2, acronym: 'DEF', text: 'DONT EAT FIGS', votes_count: 3 },
    ],
};

const gamesData = {
    games: [
        { code: 'GAME1', finished_at: '2024-06-01', score: 15, placement: '1st' },
        { code: 'GAME2', finished_at: '2024-06-02', score: 8, placement: '3rd' },
    ],
};

describe('Profile.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockAuthStore.nickname = 'TestUser';
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isGuest = false;
    });

    it('shows loading state initially', () => {
        mockProfileApi.mockReturnValue(new Promise(() => {}));
        mockSentencesApi.mockReturnValue(new Promise(() => {}));
        mockGamesApi.mockReturnValue(new Promise(() => {}));

        const wrapper = mountProfile();

        expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders profile data after load', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('TestUser');
        expect(wrapper.text()).toContain('42');
        expect(wrapper.text()).toContain('10');
        expect(wrapper.text()).toContain('24%');
    });

    it('shows settings link for own profile', async () => {
        mockAuthStore.nickname = 'TestUser';
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile({ nickname: 'TestUser' });
        await flushPromises();

        const settingsLink = wrapper.findAll('a').find((a) => a.attributes('href') === '/profil');
        expect(settingsLink).toBeTruthy();
    });

    it('hides settings link for other profiles', async () => {
        mockAuthStore.nickname = 'TestUser';
        const otherProfileData = {
            player: { ...profileData.player, nickname: 'OtherUser' },
            stats: profileData.stats,
        };
        mockProfileApi.mockResolvedValue({ data: otherProfileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile({ nickname: 'OtherUser' });
        await flushPromises();

        const settingsLink = wrapper.findAll('a').find((a) => a.attributes('href') === '/profil');
        expect(settingsLink).toBeUndefined();
    });

    it('shows error state on API failure', async () => {
        const error = new Error('Server error');
        error.response = { status: 500, data: { message: 'Internal Server Error' } };
        mockProfileApi.mockRejectedValue(error);
        mockSentencesApi.mockRejectedValue(error);
        mockGamesApi.mockRejectedValue(error);

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('Internal Server Error');
        // Should show retry button
        const retryBtn = wrapper.findAll('button').find((btn) => btn.text().includes('common.retry'));
        expect(retryBtn).toBeTruthy();
    });

    it('shows not found error on 404', async () => {
        const error = new Error('Not found');
        error.response = { status: 404, data: {} };
        mockProfileApi.mockRejectedValue(error);
        mockSentencesApi.mockRejectedValue(error);
        mockGamesApi.mockRejectedValue(error);

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('common.notFound');
    });

    it('stats display correct values', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('42');
        expect(wrapper.text()).toContain('profile.gamesPlayed');
        expect(wrapper.text()).toContain('10');
        expect(wrapper.text()).toContain('profile.gamesWon');
        expect(wrapper.text()).toContain('24%');
        expect(wrapper.text()).toContain('profile.winRate');
        expect(wrapper.text()).toContain('55');
        expect(wrapper.text()).toContain('profile.roundsWon');
        expect(wrapper.text()).toContain('120');
        expect(wrapper.text()).toContain('profile.votesReceived');
    });

    it('renders best sentences tab content', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('ABC');
        expect(wrapper.text()).toContain('a big cat');
        expect(wrapper.text()).toContain('DEF');
        expect(wrapper.text()).toContain('dont eat figs');
    });

    it('renders game history tab content', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('#GAME1');
        expect(wrapper.text()).toContain('15');
        expect(wrapper.text()).toContain('1st');
        expect(wrapper.text()).toContain('#GAME2');
    });

    it('shows no sentences message when sentences empty', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: { sentences: [] } });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('hallOfFame.noSentences');
    });

    it('shows no games message when games empty', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: { games: [] } });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('archive.noGames');
    });

    it('shows bot badge for bot player', async () => {
        const botProfile = {
            player: { ...profileData.player, is_bot: true },
            stats: profileData.stats,
        };
        mockProfileApi.mockResolvedValue({ data: botProfile });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('profile.botPlayer');
    });

    it('shows guest badge for guest player', async () => {
        const guestProfile = {
            player: { ...profileData.player, is_guest: true },
            stats: profileData.stats,
        };
        mockProfileApi.mockResolvedValue({ data: guestProfile });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        const wrapper = mountProfile();
        await flushPromises();

        expect(wrapper.text()).toContain('profile.guestPlayer');
    });

    it('calls API with correct nickname', async () => {
        mockProfileApi.mockResolvedValue({ data: profileData });
        mockSentencesApi.mockResolvedValue({ data: sentencesData });
        mockGamesApi.mockResolvedValue({ data: gamesData });

        mountProfile({ nickname: 'SomePlayer' });
        await flushPromises();

        expect(mockProfileApi).toHaveBeenCalledWith('SomePlayer');
        expect(mockSentencesApi).toHaveBeenCalledWith('SomePlayer', { limit: 10 });
        expect(mockGamesApi).toHaveBeenCalledWith('SomePlayer', { limit: 20 });
    });
});
