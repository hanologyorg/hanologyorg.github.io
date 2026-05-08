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

      const library = JSON.parse(
        readFileSync(resolve(__dirname, 'public/data/library.json'), 'utf-8')
      )
      const authors: { name: string }[] = JSON.parse(
        readFileSync(resolve(__dirname, 'public/data/authors.json'), 'utf-8')
      )

      for (const book of library.books) {
        result.push(`/${book.id}`)
        const bookData = JSON.parse(
          readFileSync(resolve(__dirname, `public/data/books/${book.id}.json`), 'utf-8')
        )
        for (const piece of bookData.pieces) {
          result.push(`/${book.id}/${piece.num}`)
        }
      }

      for (const a of authors) {
        result.push(`/author/${encodeURIComponent(a.name)}`)
      }

      return result
    },
  },
})
