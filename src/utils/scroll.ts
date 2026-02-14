export const captureScrollTop = (element: HTMLElement | null): number => {
  if (!element) {
    return 0
  }

  return element.scrollTop
}

export const restoreScrollTop = (
  element: HTMLElement | null,
  scrollTop: number,
): void => {
  if (!element) {
    return
  }

  requestAnimationFrame(() => {
    element.scrollTop = scrollTop
  })
}
