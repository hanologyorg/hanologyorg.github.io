import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  type RouteRecordRaw,
} from 'vue-router'
import HomeView from './views/HomeView.vue'
import PoemView from './views/PoemView.vue'
import AuthorView from './views/AuthorView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', component: HomeView },
  { path: '/poem/:num', component: PoemView, props: true },
  { path: '/author/:name', component: AuthorView, props: true },
]

export function createRouterInstance() {
  return createRouter({
    history: typeof window !== 'undefined'
      ? createWebHistory()
      : createMemoryHistory(),
    routes,
    scrollBehavior() {
      return { top: 0 }
    },
  })
}
