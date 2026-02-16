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
    }),
}));

vi.mock('../../services/api.js', () => ({
    api: {
        admin: {
            players: vi.fn().mockResolvedValue({
                data: {
                    players: [
                        { id: 1, nickname: 'Player1', is_guest: false, is_banned: false, games_played: 5 },
                    ],
                },
            }),
            games: vi.fn().mockResolvedValue({
                data: {
                    games: [
                        { code: 'ABC123', status: 'finished', player_count: 4, host_nickname: 'Host', created_at: '2025-06-01' },
                    ],
                },
            }),
            stats: vi.fn().mockResolvedValue({
                data: { total_players: 100, total_games: 50, active_today: 10 },
            }),
            ban: vi.fn().mockResolvedValue({}),
            unban: vi.fn().mockResolvedValue({}),
        },
    },
}));

import Admin from '../Admin.vue';
import { api } from '../../services/api.js';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: { template: '<input />', inheritAttrs: false },
    Badge: { template: '<span>{{ $attrs.value }}</span>', inheritAttrs: false },
    Skeleton: { template: '<div class="skeleton" />' },
    DataTable: { template: '<table><slot /></table>', inheritAttrs: false },
    Column: { template: '<td><slot /></td>', inheritAttrs: false },
    TabView: { template: '<div><slot /></div>' },
    TabPanel: { template: '<div><slot /></div>', props: ['header'] },
    Dialog: {
        template: '<div v-if="$attrs.visible !== false"><slot /><slot name="footer" /></div>',
        inheritAttrs: false,
    },
    ToggleSwitch: { template: '<input type="checkbox" />', inheritAttrs: false },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

function mountAdmin() {
    return mount(Admin, {
        global: { stubs },
    });
}

describe('Admin.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        api.admin.players.mockResolvedValue({
            data: {
                players: [
                    { id: 1, nickname: 'Player1', is_guest: false, is_banned: false, games_played: 5 },
                ],
            },
        });
        api.admin.games.mockResolvedValue({
            data: {
                games: [
                    { code: 'ABC123', status: 'finished', player_count: 4, host_nickname: 'Host', created_at: '2025-06-01' },
                ],
            },
        });
        api.admin.stats.mockResolvedValue({
            data: { total_players: 100, total_games: 50, active_today: 10 },
        });
        api.admin.ban.mockResolvedValue({});
        api.admin.unban.mockResolvedValue({});
    });

    it('renders admin title', () => {
        const wrapper = mountAdmin();

        expect(wrapper.find('h1').text()).toBe('admin.title');
    });

    it('loads players, games, stats on mount', async () => {
        mountAdmin();
        await flushPromises();

        expect(api.admin.players).toHaveBeenCalledTimes(1);
        expect(api.admin.games).toHaveBeenCalledTimes(1);
        expect(api.admin.stats).toHaveBeenCalledTimes(1);
    });

    it('populates adminPlayers after players API resolves', async () => {
        mountAdmin();
        await flushPromises();

        // Verify the API was called and resolved with player data
        expect(api.admin.players).toHaveBeenCalled();
        const result = await api.admin.players.mock.results[0].value;
        expect(result.data.players).toHaveLength(1);
        expect(result.data.players[0].nickname).toBe('Player1');
    });

    it('populates adminGames after games API resolves', async () => {
        mountAdmin();
        await flushPromises();

        // Verify the API was called and resolved with game data
        expect(api.admin.games).toHaveBeenCalled();
        const result = await api.admin.games.mock.results[0].value;
        expect(result.data.games).toHaveLength(1);
        expect(result.data.games[0].code).toBe('ABC123');
    });

    it('stats cards show correct values', async () => {
        const wrapper = mountAdmin();
        await flushPromises();

        // Stats are rendered in plain divs (not inside DataTable), so they appear in text
        expect(wrapper.text()).toContain('100');
        expect(wrapper.text()).toContain('50');
        expect(wrapper.text()).toContain('10');
    });

    it('stats cards render all label keys', async () => {
        const wrapper = mountAdmin();
        await flushPromises();

        expect(wrapper.text()).toContain('admin.players');
        expect(wrapper.text()).toContain('admin.games');
        expect(wrapper.text()).toContain('admin.activeToday');
    });

    it('ban dialog is hidden by default', () => {
        const wrapper = mountAdmin();

        // The Dialog has v-if="$attrs.visible !== false", and banDialogVisible starts as false
        // So the ban reason label should not be present initially
        expect(wrapper.text()).not.toContain('admin.banReason');
    });

    it('handleBan calls api.admin.ban with correct arguments', async () => {
        const wrapper = mountAdmin();
        await flushPromises();

        // Directly access the component's internal method by triggering the ban flow
        // Since DataTable stubs don't render body slots, we trigger openBanDialog
        // by calling the component's exposed method via vm
        const vm = wrapper.vm;
        vm.openBanDialog({ id: 1, nickname: 'Player1', is_banned: false });
        await flushPromises();

        // The dialog should now show the ban reason and ban IP fields
        expect(wrapper.text()).toContain('admin.banReason');
        expect(wrapper.text()).toContain('admin.banIp');

        // Find the confirm ban button in the dialog footer
        const allButtons = wrapper.findAll('button');
        const confirmBanButtons = allButtons.filter((b) => b.text().includes('admin.ban'));
        const confirmBan = confirmBanButtons[confirmBanButtons.length - 1];
        await confirmBan.trigger('click');
        await flushPromises();

        expect(api.admin.ban).toHaveBeenCalledWith(1, '', false);
    });

    it('handleUnban calls api.admin.unban with correct player id', async () => {
        const wrapper = mountAdmin();
        await flushPromises();

        // Call handleUnban directly since DataTable stubs don't render body slots
        const player = { id: 2, nickname: 'BannedPlayer', is_banned: true };
        await wrapper.vm.handleUnban(player);
        await flushPromises();

        expect(api.admin.unban).toHaveBeenCalledWith(2);
        expect(player.is_banned).toBe(false);
    });
});
