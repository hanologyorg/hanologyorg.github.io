import { type Ref, onMounted, onBeforeUnmount, readonly, ref } from 'vue'

export function useHorizontalScroll(container: Ref<HTMLElement | null>) {
  const isScrolling = ref(false)
  let scrollTimer: ReturnType<typeof setTimeout> | null = null

  function onWheel(e: WheelEvent) {
    const el = container.value
    if (!el) return

    const hasDeltaX = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5

    if (hasDeltaX) return

    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  function scrollToStart() {
    const el = container.value
    if (!el) return
    el.scrollLeft = 0
  }

  function scrollToEnd() {
    const el = container.value
    if (!el) return
    el.scrollLeft = el.scrollWidth - el.clientWidth
  }

  function onScroll() {
    isScrolling.value = true
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  onMounted(() => {
    const el = container.value
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
  })

  onBeforeUnmount(() => {
    const el = container.value
    if (!el) return
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('scroll', onScroll)
    if (scrollTimer) clearTimeout(scrollTimer)
  })

  return { isScrolling: readonly(isScrolling), scrollToStart, scrollToEnd }
}
