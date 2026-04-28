import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  server: {
    proxy: {
      '/api/bprs': {
        target: 'http://iba-net.02.mglobalperdana.com:33503',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/bprs/, ''),
      },
      '/api/jabmart': {
        target: 'https://api.jabmart.id',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/jabmart/, '/kan/goerpapi.asmx'),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
