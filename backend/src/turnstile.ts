import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * Cloudflare Turnstile — enabled only when BOTH keys are set in env:
 *   TURNSTILE_SITE_KEY   (public, sent to the browser)
 *   TURNSTILE_SECRET_KEY (private, used for server-side verification)
 */
const SITE_KEY = process.env.TURNSTILE_SITE_KEY?.trim() || null
const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY?.trim() || null
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const turnstileEnabled = !!(SITE_KEY && SECRET_KEY)
/** Site key for the frontend, or null when Turnstile is off. */
export const turnstileSiteKey = turnstileEnabled ? SITE_KEY : null

if (!turnstileEnabled && (SITE_KEY || SECRET_KEY))
  console.warn('[turnstile] only one of TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY is set — Turnstile is disabled')

/** Throws 400 unless the request carries a valid Turnstile token. No-op when Turnstile is off. */
export async function requireTurnstile(c: Context, token: unknown) {
  if (!turnstileEnabled) return
  if (typeof token !== 'string' || !token || token.length > 2048)
    throw new HTTPException(400, { message: 'กรุณายืนยันว่าคุณไม่ใช่บอท' })

  const body = new FormData()
  body.append('secret', SECRET_KEY!)
  body.append('response', token)
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip) body.append('remoteip', ip)

  let ok = false
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) })
    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
    ok = data.success
    if (!ok) console.warn('[turnstile] verification failed:', data['error-codes'])
  } catch (e) {
    console.error('[turnstile] verify request error:', e)
    throw new HTTPException(503, { message: 'ไม่สามารถตรวจสอบความปลอดภัยได้ กรุณาลองใหม่' })
  }
  if (!ok) throw new HTTPException(400, { message: 'การยืนยันตัวตนไม่ผ่าน กรุณาลองใหม่' })
}
