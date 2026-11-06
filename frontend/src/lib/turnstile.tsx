import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loader: Promise<TurnstileApi> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    s.onerror = () => { loader = null; reject(new Error('โหลด Turnstile ไม่สำเร็จ')) }
    document.head.appendChild(s)
  })
  return loader
}

/**
 * Cloudflare Turnstile widget. Renders nothing when `siteKey` is null.
 * Tokens are single-use: remount it (change its React `key`) after each submit.
 */
export function Turnstile({ siteKey, onToken }: { siteKey: string | null; onToken: (token: string) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    if (!siteKey || !el.current) return
    let id: string | null = null
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !el.current) return
        id = t.render(el.current, {
          sitekey: siteKey,
          language: 'th',
          theme: 'light',
          callback: (token: string) => cb.current(token),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        })
      })
      .catch(() => cb.current(''))
    return () => {
      cancelled = true
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={el} className="turnstile" />
}
