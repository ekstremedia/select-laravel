import { mount } from '@vue/test-utils';
import ErrorPage from '../ErrorPage.vue';

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

describe('ErrorPage', () => {
    function mountErrorPage(status) {
        return mount(ErrorPage, {
            props: { status },
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

    describe('status code rendering', () => {
        it('renders 403 status code', () => {
            const wrapper = mountErrorPage(403);
            expect(wrapper.find('h1').text()).toBe('403');
        });

        it('renders 404 status code', () => {
            const wrapper = mountErrorPage(404);
            expect(wrapper.find('h1').text()).toBe('404');
        });

        it('renders 500 status code', () => {
            const wrapper = mountErrorPage(500);
            expect(wrapper.find('h1').text()).toBe('500');
        });

        it('renders 503 status code', () => {
            const wrapper = mountErrorPage(503);
            expect(wrapper.find('h1').text()).toBe('503');
        });
    });

    describe('title rendering', () => {
        it('renders common.forbidden title for 403', () => {
            const wrapper = mountErrorPage(403);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[0].text()).toBe('common.forbidden');
        });

        it('renders common.notFound title for 404', () => {
            const wrapper = mountErrorPage(404);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[0].text()).toBe('common.notFound');
        });

        it('renders common.serverError title for 500', () => {
            const wrapper = mountErrorPage(500);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[0].text()).toBe('common.serverError');
        });

        it('renders common.serviceUnavailable title for 503', () => {
            const wrapper = mountErrorPage(503);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[0].text()).toBe('common.serviceUnavailable');
        });
    });

    describe('description rendering', () => {
        it('renders common.forbiddenDesc description for 403', () => {
            const wrapper = mountErrorPage(403);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[1].text()).toBe('common.forbiddenDesc');
        });

        it('renders common.notFoundDesc description for 404', () => {
            const wrapper = mountErrorPage(404);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[1].text()).toBe('common.notFoundDesc');
        });

        it('renders common.serverErrorDesc description for 500', () => {
            const wrapper = mountErrorPage(500);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[1].text()).toBe('common.serverErrorDesc');
        });

        it('renders common.serviceUnavailableDesc description for 503', () => {
            const wrapper = mountErrorPage(503);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[1].text()).toBe('common.serviceUnavailableDesc');
        });
    });

    describe('fallback for unknown status', () => {
        it('renders common.error as title for unknown status code', () => {
            const wrapper = mountErrorPage(418);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[0].text()).toBe('common.error');
        });

        it('renders common.error as description for unknown status code', () => {
            const wrapper = mountErrorPage(418);
            const paragraphs = wrapper.findAll('p');
            expect(paragraphs[1].text()).toBe('common.error');
        });
    });

    describe('navigation', () => {
        it('calls router.visit with / when button is clicked', async () => {
            const wrapper = mountErrorPage(404);

            await wrapper.find('button').trigger('click');

            expect(router.visit).toHaveBeenCalledWith('/');
        });
    });
});
