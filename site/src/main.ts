import { createApp as _createApp } from 'vue'
import { createRouterInstance, routes } from './router'
import { useData } from './composables/useData'
import App from './App.vue'
import './styles/main.css'

export async function createApp() {
  const { loadData } = useData()
  await loadData()
  const router = createRouterInstance()
  const app = _createApp(App)
  app.use(router)
  return { app, router, routes }
}

if (!import.meta.env.SSR) {
  createApp().then(({ app, router }) => {
    app.mount('#app')
    document.getElementById('app-loading')?.remove()
  })
}
