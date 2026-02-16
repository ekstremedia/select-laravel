import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CreateGame from '../CreateGame.vue';

const mockGameStore = { createGame: vi.fn() };
vi.mock('../../stores/gameStore.js', () => ({ useGameStore: () => mockGameStore }));

const mockAuthStore = { player: { id: 'p1', nickname: 'TestPlayer' } };
vi.mock('../../stores/authStore.js', () => ({ useAuthStore: () => mockAuthStore }));

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({ props: {}, url: '/' })),
}));

vi.mock('../../composables/useI18n.js', () => ({
    useI18n: () => ({ t: (key) => key, toggleLocale: vi.fn(), locale: { value: 'no' }, isNorwegian: { value: true } }),
}));

import { router } from '@inertiajs/vue3';

const stubs = {
    Button: { template: '<button :type="$attrs.type" :disabled="$attrs.disabled" :class="{ loading: $attrs.loading }" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>', inheritAttrs: false },
    InputText: {
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        props: ['modelValue'],
        emits: ['update:modelValue'],
    },
    Slider: { template: '<input type="range" />', inheritAttrs: false },
    ToggleSwitch: { template: '<input type="checkbox" />', inheritAttrs: false },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

function mountCreateGame() {
    return mount(CreateGame, {
        global: {
            stubs,
        },
    });
}

describe('CreateGame.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('renders form with all setting fields', () => {
        const wrapper = mountCreateGame();

        expect(wrapper.text()).toContain('create.title');
        expect(wrapper.text()).toContain('create.rounds');
        expect(wrapper.text()).toContain('create.answerTime');
        expect(wrapper.text()).toContain('create.voteTime');
        expect(wrapper.text()).toContain('create.timeBetweenRounds');
        expect(wrapper.text()).toContain('create.maxEdits');
        expect(wrapper.text()).toContain('create.maxVoteChanges');
        expect(wrapper.text()).toContain('create.readyCheck');
        expect(wrapper.text()).toContain('create.chat');
        expect(wrapper.text()).toContain('create.acronymLength');
        expect(wrapper.text()).toContain('create.maxPlayers');
        expect(wrapper.text()).toContain('create.excludeLetters');
        expect(wrapper.text()).toContain('create.weightedAcronyms');
        expect(wrapper.text()).toContain('create.visibility');
    });

    it('renders default setting values', () => {
        const wrapper = mountCreateGame();

        // Check default values are rendered in labels
        expect(wrapper.text()).toContain(': 8'); // rounds default
        expect(wrapper.text()).toContain(': 60'); // answer_time default
        expect(wrapper.text()).toContain(': 30'); // vote_time and time_between_rounds defaults
    });

    it('password field hidden when public (default)', () => {
        const wrapper = mountCreateGame();

        // Password label should not be present when is_private is false (default)
        expect(wrapper.text()).not.toContain('create.password');
    });

    it('password field visible when is_private is toggled', async () => {
        const wrapper = mountCreateGame();

        // Click the "private" button to toggle visibility
        const buttons = wrapper.findAll('button');
        const privateButton = buttons.find(b => b.text().includes('create.private'));
        expect(privateButton).toBeTruthy();

        await privateButton.trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('create.password');
    });

    it('handleCreate builds correct payload and navigates on success', async () => {
        mockGameStore.createGame.mockResolvedValue({ game: { code: 'NEWGM' } });

        const wrapper = mountCreateGame();

        // Submit the form with defaults
        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.createGame).toHaveBeenCalledTimes(1);

        const payload = mockGameStore.createGame.mock.calls[0][0];

        // Verify settings structure
        expect(payload.settings).toBeDefined();
        expect(payload.settings.rounds).toBe(8);
        expect(payload.settings.answer_time).toBe(60);
        expect(payload.settings.vote_time).toBe(30);
        expect(payload.settings.time_between_rounds).toBe(30);
        expect(payload.settings.acronym_length_min).toBe(5);
        expect(payload.settings.acronym_length_max).toBe(5);
        expect(payload.settings.max_players).toBe(8);
        expect(payload.settings.chat_enabled).toBe(true);
        expect(payload.settings.allow_ready_check).toBe(true);
        expect(payload.settings.max_edits).toBe(0);
        expect(payload.settings.max_vote_changes).toBe(0);
        expect(payload.settings.weighted_acronyms).toBe(false);

        // Public by default
        expect(payload.is_public).toBe(true);

        // No password when public
        expect(payload.password).toBeUndefined();

        // No excluded_letters when empty
        expect(payload.settings.excluded_letters).toBeUndefined();

        // Navigates to the game
        expect(router.visit).toHaveBeenCalledWith('/spill/NEWGM');
    });

    it('handleCreate includes password in payload when private', async () => {
        mockGameStore.createGame.mockResolvedValue({ game: { code: 'PRIVG' } });

        const wrapper = mountCreateGame();

        // Toggle to private
        const buttons = wrapper.findAll('button');
        const privateButton = buttons.find(b => b.text().includes('create.private'));
        await privateButton.trigger('click');
        await flushPromises();

        // Set password via the input that appeared
        const inputs = wrapper.findAll('input');
        // The password input appears after toggling private
        const passwordInput = inputs[inputs.length - 1];
        await passwordInput.setValue('secret123');
        await flushPromises();

        // Submit
        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        const payload = mockGameStore.createGame.mock.calls[0][0];
        expect(payload.is_public).toBe(false);
        expect(payload.password).toBe('secret123');
    });

    it('handleCreate navigates using gameStore.gameCode fallback', async () => {
        // When data.game is undefined but gameStore has a gameCode
        mockGameStore.createGame.mockResolvedValue({});
        mockGameStore.gameCode = 'FALLB';

        const wrapper = mountCreateGame();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(router.visit).toHaveBeenCalledWith('/spill/FALLB');
    });

    it('shows error on failure', async () => {
        mockGameStore.createGame.mockRejectedValue({
            response: { data: { message: 'Game creation failed' } },
        });

        const wrapper = mountCreateGame();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('Game creation failed');
    });

    it('shows generic error when failure has no message', async () => {
        mockGameStore.createGame.mockRejectedValue(new Error('Network error'));

        const wrapper = mountCreateGame();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('common.error');
    });

    it('back button navigates to /spill', async () => {
        const wrapper = mountCreateGame();

        const buttons = wrapper.findAll('button');
        const backButton = buttons.find(b => b.text().includes('common.back'));
        expect(backButton).toBeTruthy();

        await backButton.trigger('click');

        expect(router.visit).toHaveBeenCalledWith('/spill');
    });
});
