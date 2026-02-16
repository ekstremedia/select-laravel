import { mount } from '@vue/test-utils';
import NotFound from '../NotFound.vue';

vi.mock('@inertiajs/vue3', () => ({
    router: { visit: vi.fn() },
    Link: { template: '<a :href="$attrs.href"><slot /></a>' },
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

import { router } from '@inertiajs/vue3';

describe('NotFound', () => {
    function mountNotFound() {
        return mount(NotFound, {
            global: {
                stubs: {
                    Button: {
                        template: '<button @click="$emit(\'click\')"><slot />{{ $attrs.label }}</button>',
                        inheritAttrs: false,
                    },
                },
            },
        });
    }

    it('renders 404 text', () => {
        const wrapper = mountNotFound();
        expect(wrapper.find('h1').text()).toBe('404');
    });

    it('renders translated notFound string', () => {
        const wrapper = mountNotFound();
        const paragraphs = wrapper.findAll('p');
        expect(paragraphs[0].text()).toBe('common.notFound');
    });

    it('renders translated notFoundDesc string', () => {
        const wrapper = mountNotFound();
        const paragraphs = wrapper.findAll('p');
        expect(paragraphs[1].text()).toBe('common.notFoundDesc');
    });

    it('renders button with translated goHome label', () => {
        const wrapper = mountNotFound();
        const button = wrapper.find('button');
        expect(button.text()).toContain('common.goHome');
    });

    it('calls router.visit with / when button is clicked', async () => {
        const wrapper = mountNotFound();

        await wrapper.find('button').trigger('click');

        expect(router.visit).toHaveBeenCalledWith('/');
    });
});
