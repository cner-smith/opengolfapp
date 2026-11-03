import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const counted = (key: string | undefined) => {
  if (!key) return false
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

// Counts a figure to its value: from 0 on mount, from the old value when the
// target changes, so the number lands rather than swapping. `onceKey` counts
// only once per session (Home, SHL-05). Static under reduced motion.
export function useCountUp<T extends number | null>(
  target: T,
  { delay = 0, duration = 600, onceKey }: { delay?: number; duration?: number; onceKey?: string } = {},
): T {
  const [skip] = useState(() => reducedMotion() || counted(onceKey))
  const [shown, setShown] = useState<number | null>(target == null || skip ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null || skip) {
      setShown(target)
      return
    }
    const start = from.current
    let raf = 0
    let t0 = 0
    const tick = (now: number) => {
      if (!t0) t0 = now + delay
      const t = Math.min(1, Math.max(0, (now - t0) / duration))
      const v = start + (target - start) * (1 - Math.pow(1 - t, 4))
      from.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else if (onceKey) {
        try {
          sessionStorage.setItem(onceKey, '1')
        } catch {
          /* private mode: count again next time */
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, duration, onceKey, skip])
  return shown as T
}
