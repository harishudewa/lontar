import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
    plugins: [devtools(), solidPlugin(), tailwindcss(), wasm()],
    server: {
        port: 3000,
    },
});
