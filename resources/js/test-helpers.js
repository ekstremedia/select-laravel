/**
 * Shared test helpers for Vue component tests.
 *
 * Usage:
 *   import { createWrapper, stubComponents } from '../../test-helpers.js';
 *   const wrapper = createWrapper(MyComponent, { props: { ... } });
 */
import { mount, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

// Common PrimeVue component stubs
export const stubComponents = {
    Button: { template: '<button><slot />{{ $attrs.label }}</button>', inheritAttrs: false },
    InputText: { template: '<input />', inheritAttrs: false },
    Password: { template: '<input type="password" />', inheritAttrs: false },
    Badge: { template: '<span><slot />{{ $attrs.value }}</span>', inheritAttrs: false },
    Skeleton: { template: '<div class="skeleton" />' },
    ProgressBar: { template: '<div class="progress-bar" />' },
    Toast: { template: '<div class="toast" />' },
    ConfirmDialog: { template: '<div />' },
    Dialog: { template: '<div v-if="$attrs.visible !== false"><slot /><slot name="footer" /></div>', inheritAttrs: false },
    Slider: { template: '<input type="range" />', inheritAttrs: false },
    ToggleSwitch: { template: '<input type="checkbox" />', inheritAttrs: false },
    TabView: { template: '<div><slot /></div>' },
    TabPanel: { template: '<div><slot /></div>', props: ['header'] },
    DataTable: { template: '<table><slot /></table>', inheritAttrs: false },
    Column: { template: '<td><slot /></td>', inheritAttrs: false },
    Popover: { template: '<div><slot /></div>' },
    PlayerAvatar: { template: '<div class="avatar" />', props: ['nickname', 'avatarUrl', 'size'] },
    Link: { template: '<a :href="$attrs.href"><slot /></a>', inheritAttrs: false },
    Transition: { template: '<div><slot /></div>' },
};

/**
 * Create a mounted wrapper with common defaults.
 *
 * @param {Object} component  Vue component to mount
 * @param {Object} options    mount() options (props, slots, global overrides, etc.)
 * @param {boolean} shallow   Use shallowMount instead of mount
 */
export function createWrapper(component, options = {}, shallow = false) {
    const pinia = createPinia();
    setActivePinia(pinia);

    const mountFn = shallow ? shallowMount : mount;

    return mountFn(component, {
        global: {
            plugins: [pinia],
            stubs: {
                ...stubComponents,
                ...(options.global?.stubs || {}),
            },
            mocks: {
                ...(options.global?.mocks || {}),
            },
            provide: {
                ...(options.global?.provide || {}),
            },
        },
        ...options,
        // Remove global from the spread to avoid duplication
        global: undefined,
        ...(options.props ? { props: options.props } : {}),
        ...(options.slots ? { slots: options.slots } : {}),
        ...(options.attachTo ? { attachTo: options.attachTo } : {}),
    });
}

// Re-export for convenience
export { mount, shallowMount } from '@vue/test-utils';
export { createPinia, setActivePinia } from 'pinia';
