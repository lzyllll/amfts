import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'AMF',
            fileName: 'amf',
            formats: ['es']
        },
        sourcemap: true
    },
    plugins: [
        dts({
            include: ['src/**/*'],
            rollupTypes: true
        })
    ]
});
