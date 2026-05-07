import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    includedRoutes(paths, routes) {
      const result = ['/']

      const authors: { name: string }[] = JSON.parse(
        readFileSync(resolve(__dirname, 'public/data/authors.json'), 'utf-8')
      )

      for (const route of routes) {
        if (route.path === '/poem/:num') {
          for (let i = 1; i <= 100; i++) {
            result.push(`/poem/${i}`)
          }
        }
        if (route.path === '/author/:name') {
          for (const a of authors) {
            result.push(`/author/${encodeURIComponent(a.name)}`)
          }
        }
      }
      return result
    },
  },
})
