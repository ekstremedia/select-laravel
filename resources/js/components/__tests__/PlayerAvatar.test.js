import { mount } from '@vue/test-utils';
import PlayerAvatar from '../PlayerAvatar.vue';

function getFallbackDiv(wrapper) {
    const allDivs = wrapper.findAll('div');
    return allDivs[allDivs.length - 1];
}

describe('PlayerAvatar', () => {
    describe('fallback rendering', () => {
        it('renders first letter of nickname uppercase when no avatar URL', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'alice' },
            });

            expect(wrapper.find('img').exists()).toBe(false);
            const fallback = getFallbackDiv(wrapper);
            expect(fallback.exists()).toBe(true);
            expect(fallback.text()).toBe('A');
        });

        it('renders first letter uppercase for various nicknames', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'bob' },
            });

            expect(getFallbackDiv(wrapper).text()).toBe('B');
        });
    });

    describe('image rendering', () => {
        it('renders img tag when avatarUrl is provided', () => {
            const wrapper = mount(PlayerAvatar, {
                props: {
                    nickname: 'alice',
                    avatarUrl: 'https://example.com/avatar.png',
                },
            });

            const img = wrapper.find('img');
            expect(img.exists()).toBe(true);
            expect(img.attributes('src')).toBe('https://example.com/avatar.png');
            expect(img.attributes('alt')).toBe('alice');
        });

        it('shows fallback when img error triggers', async () => {
            const wrapper = mount(PlayerAvatar, {
                props: {
                    nickname: 'alice',
                    avatarUrl: 'https://example.com/broken.png',
                },
            });

            expect(wrapper.find('img').exists()).toBe(true);

            await wrapper.find('img').trigger('error');

            expect(wrapper.find('img').exists()).toBe(false);
            const fallback = getFallbackDiv(wrapper);
            expect(fallback.exists()).toBe(true);
            expect(fallback.text()).toBe('A');
        });
    });

    describe('size classes', () => {
        it('applies xs size classes', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'test', size: 'xs' },
            });

            expect(wrapper.classes()).toContain('w-6');
            expect(wrapper.classes()).toContain('h-6');

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.classes()).toContain('text-xs');
        });

        it('applies sm size classes', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'test', size: 'sm' },
            });

            expect(wrapper.classes()).toContain('w-8');
            expect(wrapper.classes()).toContain('h-8');

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.classes()).toContain('text-sm');
        });

        it('applies md size classes by default', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'test' },
            });

            expect(wrapper.classes()).toContain('w-10');
            expect(wrapper.classes()).toContain('h-10');

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.classes()).toContain('text-base');
        });

        it('applies lg size classes', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'test', size: 'lg' },
            });

            expect(wrapper.classes()).toContain('w-16');
            expect(wrapper.classes()).toContain('h-16');

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.classes()).toContain('text-2xl');
        });

        it('applies xl size classes', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: 'test', size: 'xl' },
            });

            expect(wrapper.classes()).toContain('w-20');
            expect(wrapper.classes()).toContain('h-20');

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.classes()).toContain('text-3xl');
        });
    });

    describe('empty nickname', () => {
        it('handles empty nickname gracefully', () => {
            const wrapper = mount(PlayerAvatar, {
                props: { nickname: '' },
            });

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.exists()).toBe(true);
            expect(fallback.text()).toBe('');
        });

        it('handles undefined nickname gracefully', () => {
            const wrapper = mount(PlayerAvatar, {
                props: {},
            });

            const fallback = getFallbackDiv(wrapper);
            expect(fallback.exists()).toBe(true);
            expect(fallback.text()).toBe('');
        });
    });
});
