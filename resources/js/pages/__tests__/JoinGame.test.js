import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import JoinGame from '../JoinGame.vue';

const mockGameStore = { joinGame: vi.fn() };
vi.mock('../../stores/gameStore.js', () => ({ useGameStore: () => mockGameStore }));

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
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'input\', $event)" />',
        props: ['modelValue'],
        emits: ['update:modelValue', 'input'],
    },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
};

function mountJoinGame() {
    return mount(JoinGame, {
        global: {
            stubs,
        },
    });
}

describe('JoinGame.vue', () => {
    let originalLocation;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        // Save original window.location and replace with a mock
        originalLocation = window.location;
        delete window.location;
        window.location = { search: '', href: '' };
    });

    afterEach(() => {
        window.location = originalLocation;
    });

    it('renders code input and join button', () => {
        const wrapper = mountJoinGame();

        expect(wrapper.find('input').exists()).toBe(true);
        expect(wrapper.text()).toContain('games.joinByCode');
        expect(wrapper.text()).toContain('games.enterCode');
        expect(wrapper.text()).toContain('games.join');
    });

    it('renders back link', () => {
        const wrapper = mountJoinGame();

        const backLink = wrapper.find('a[href="/spill"]');
        expect(backLink.exists()).toBe(true);
        expect(backLink.text()).toContain('common.back');
    });

    it('input transforms to uppercase via handleInput', async () => {
        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('abcd');
        await input.trigger('input');
        await flushPromises();

        // Input value should be uppercased immediately
        expect(input.element.value).toBe('ABCD');

        // Also verify by submitting the form and checking the joinGame call
        mockGameStore.joinGame.mockResolvedValue({});

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).toHaveBeenCalledWith('ABCD');
    });

    it('input filters non-alphanumeric characters', async () => {
        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('ab!@12');
        await input.trigger('input');
        await flushPromises();

        mockGameStore.joinGame.mockResolvedValue({});

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).toHaveBeenCalledWith('AB12');
    });

    it('join button disabled when code too short', () => {
        const wrapper = mountJoinGame();

        const joinButton = wrapper.find('button[type="submit"]');
        expect(joinButton.attributes('disabled')).toBeDefined();
    });

    it('join button enabled when code has 4+ characters', async () => {
        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('ABCD');
        await input.trigger('input');
        await flushPromises();

        const joinButton = wrapper.find('button[type="submit"]');
        expect(joinButton.attributes('disabled')).toBeUndefined();
    });

    it('handleJoin calls gameStore.joinGame and navigates on success', async () => {
        mockGameStore.joinGame.mockResolvedValue({});

        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('TEST');
        await input.trigger('input');
        await flushPromises();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).toHaveBeenCalledWith('TEST');
        expect(router.visit).toHaveBeenCalledWith('/spill/TEST');
    });

    it('handleJoin does not call joinGame when code < 4 chars', async () => {
        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('AB');
        await input.trigger('input');
        await flushPromises();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).not.toHaveBeenCalled();
        expect(router.visit).not.toHaveBeenCalled();
    });

    it('shows error on failure with server message', async () => {
        mockGameStore.joinGame.mockRejectedValue({
            response: { data: { message: 'Game not found' } },
        });

        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('XXXX');
        await input.trigger('input');
        await flushPromises();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('Game not found');
    });

    it('shows generic error when failure has no message', async () => {
        mockGameStore.joinGame.mockRejectedValue(new Error('Network error'));

        const wrapper = mountJoinGame();

        const input = wrapper.find('input');
        await input.setValue('YYYY');
        await input.trigger('input');
        await flushPromises();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('common.error');
    });

    it('pre-fills from query params on mount', async () => {
        window.location.search = '?code=hello';

        mockGameStore.joinGame.mockResolvedValue({});

        const wrapper = mountJoinGame();
        await flushPromises();

        // Submit the form to verify the code was pre-filled (uppercase, filtered)
        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).toHaveBeenCalledWith('HELLO');
    });

    it('pre-fills from query params and truncates to 6 chars', async () => {
        window.location.search = '?code=ABCDEFGH';

        mockGameStore.joinGame.mockResolvedValue({});

        const wrapper = mountJoinGame();
        await flushPromises();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).toHaveBeenCalledWith('ABCDEF');
    });

    it('pre-fills from query params and filters special characters', async () => {
        window.location.search = '?code=AB!@CD';

        mockGameStore.joinGame.mockResolvedValue({});

        const wrapper = mountJoinGame();
        await flushPromises();

        const form = wrapper.find('form');
        await form.trigger('submit');
        await flushPromises();

        expect(mockGameStore.joinGame).toHaveBeenCalledWith('ABCD');
    });
});
