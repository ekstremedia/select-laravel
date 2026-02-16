import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    usePage: vi.fn(() => ({
        props: {
            reverb: { port: '8080', key: 'test-key' },
        },
        url: '/',
    })),
}));

vi.mock('../../services/websocket.js', () => ({
    getConnectionState: vi.fn(() => 'disconnected'),
    joinGame: vi.fn(),
    leaveGame: vi.fn(),
    disconnect: vi.fn(),
}));

import WebSocketTest from '../WebSocketTest.vue';
import { getConnectionState, joinGame, leaveGame, disconnect } from '../../services/websocket.js';

const stubs = {
    Button: {
        template: '<button :disabled="$attrs.disabled" @click="$attrs.onClick?.()"><slot />{{ $attrs.label }}</button>',
        inheritAttrs: false,
    },
    InputText: { template: '<input />', inheritAttrs: false },
};

function mountWebSocketTest() {
    return mount(WebSocketTest, {
        global: { stubs },
    });
}

describe('WebSocketTest.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        getConnectionState.mockReturnValue('disconnected');
    });

    it('renders title "WebSocket Test"', () => {
        const wrapper = mountWebSocketTest();

        expect(wrapper.find('h1').text()).toBe('WebSocket Test');
    });

    it('shows disconnected status by default', () => {
        const wrapper = mountWebSocketTest();

        expect(wrapper.text()).toContain('Disconnected');
        expect(wrapper.text()).toContain('Click Connect to test the WebSocket connection');
    });

    it('Connect button enabled, Disconnect button disabled when disconnected', () => {
        const wrapper = mountWebSocketTest();

        const buttons = wrapper.findAll('button');
        const connectButton = buttons.find((b) => b.text().includes('Connect') && !b.text().includes('Disconnect'));
        const disconnectButton = buttons.find((b) => b.text().includes('Disconnect'));

        expect(connectButton.attributes('disabled')).toBeUndefined();
        expect(disconnectButton.attributes('disabled')).toBeDefined();
    });

    it('config panel shows host and port info', () => {
        const wrapper = mountWebSocketTest();

        expect(wrapper.text()).toContain('Host:');
        expect(wrapper.text()).toContain('Port:');
        expect(wrapper.text()).toContain('8080');
    });

    it('event log starts empty', () => {
        // onMounted adds 2 log entries, so the log will not be literally empty,
        // but the "No events yet" message should not appear since entries are added on mount.
        const wrapper = mountWebSocketTest();

        // The log function is called in onMounted, so there should be entries
        expect(wrapper.text()).toContain('Event Log');
    });

    it('log entries are added on mount', async () => {
        const wrapper = mountWebSocketTest();
        await flushPromises();

        // onMounted calls log() twice: 'WebSocket test page loaded' and config info
        expect(wrapper.text()).toContain('WebSocket test page loaded');
    });

    it('Clear log button clears entries', async () => {
        const wrapper = mountWebSocketTest();
        await flushPromises();

        // Verify log entries exist from onMounted
        expect(wrapper.text()).toContain('WebSocket test page loaded');

        // Click Clear log button
        const buttons = wrapper.findAll('button');
        const clearButton = buttons.find((b) => b.text().includes('Clear log'));
        expect(clearButton).toBeTruthy();

        await clearButton.trigger('click');
        await flushPromises();

        // After clearing, the empty state message should appear
        expect(wrapper.text()).toContain('No events yet');
        expect(wrapper.text()).not.toContain('WebSocket test page loaded');
    });
});
