import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 部署在 GitHub Pages 的 https://seanchang-3245.github.io/habit-tracker/
export default defineConfig({
  base: '/habit-tracker/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '習慣養成',
        short_name: '習慣養成',
        description: '記錄每天的習慣、累積分數、兌換獎勵',
        lang: 'zh-TW',
        theme_color: '#059669',
        background_color: '#fafafa',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
