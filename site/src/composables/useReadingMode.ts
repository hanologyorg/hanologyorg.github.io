import { ref, watch } from 'vue'

export type Theme = 'light' | 'sepia' | 'dark' | 'oled'
export type LayoutMode = 'horizontal' | 'vertical'

export const THEMES: Theme[] = ['light', 'sepia', 'dark', 'oled']

export const THEME_LABELS: Record<Theme, string> = {
  light: '亮',
  sepia: '暖',
  dark: '暗',
  oled: '黑',
}

const theme = ref<Theme>('light')
const layout = ref<LayoutMode>('vertical')

if (!import.meta.env.SSR) {
  const savedTheme = localStorage.getItem('theme') as Theme | null
  if (savedTheme && THEMES.includes(savedTheme)) theme.value = savedTheme

  const savedLayout = localStorage.getItem('layout') as LayoutMode | null
  if (savedLayout === 'vertical' || savedLayout === 'horizontal') layout.value = savedLayout

  watch(theme, t => {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('theme', t)
  }, { immediate: true })

  watch(layout, l => {
    document.documentElement.setAttribute('data-layout', l)
    localStorage.setItem('layout', l)
  }, { immediate: true })
}

export function useReadingMode() {
  function setTheme(t: Theme) { theme.value = t }
  function cycleTheme() {
    const idx = THEMES.indexOf(theme.value)
    theme.value = THEMES[(idx + 1) % THEMES.length]
  }
  function setLayout(l: LayoutMode) { layout.value = l }
  function toggleLayout() {
    layout.value = layout.value === 'horizontal' ? 'vertical' : 'horizontal'
  }
  return { theme, layout, setTheme, cycleTheme, setLayout, toggleLayout }
}
