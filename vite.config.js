import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
let gitHash = 'unknown';
try {
    gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
    // .git may not be available in Docker/CI builds
}

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __APP_GIT_HASH__: JSON.stringify(gitHash),
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        vue(),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['resources/js/test-setup.js'],
    },
});
