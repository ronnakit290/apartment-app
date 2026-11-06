import { and, asc, count, eq, gt, lt, ne } from 'drizzle-orm'
import type { Context, Hono, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { db } from './db'
import { sessions, users } from './schema'

export type Role = 'owner' | 'staff'
export type AuthUser = { id: number; username: string; name: string; role: Role }
export type AuthEnv = { Variables: { user: AuthUser } }

const COOKIE = 'sid'
const SESSION_MS = 30 * 24 * 3600 * 1000
const PUBLIC_PATHS = ['/api/public', '/api/auth/status', '/api/auth/login', '/api/auth/setup']
/** Paths only an owner may call (any method). */
const OWNER_ONLY = [/^\/api\/users(\/|$)/]
/** Paths only an owner may change (non-GET). */
const OWNER_WRITE = [/^\/api\/settings$/]

const fail = (status: 400 | 401 | 403 | 429, message: string): never => {
  throw new HTTPException(status, { message })
}

const sha256 = (s: string) => new Bun.CryptoHasher('sha256').update(s).digest('hex')
const publicUser = (u: typeof users.$inferSelect): AuthUser => ({ id: u.id, username: u.username, name: u.name, role: u.role })
const ownerCount = () =>
  db.select({ n: count() }).from(users).where(and(eq(users.role, 'owner'), eq(users.active, 1))).get()!.n

function validateCredentials(username: unknown, password: unknown) {
  const u = String(username ?? '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) fail(400, 'ชื่อผู้ใช้ต้องเป็น a-z, 0-9, . _ - ยาว 3-32 ตัวอักษร')
  if (password !== undefined) validatePassword(password)
  return u
}
function validatePassword(password: unknown) {
  const p = String(password ?? '')
  if (p.length < 8) fail(400, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร')
  if (p.length > 128) fail(400, 'รหัสผ่านยาวเกินไป')
  return p
}

function startSession(c: Context, userId: number) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  db.insert(sessions).values({ id: sha256(token), user_id: userId, expires_at: Date.now() + SESSION_MS }).run()
  db.update(users).set({ last_login_at: new Date().toISOString() }).where(eq(users.id, userId)).run()
  db.delete(sessions).where(lt(sessions.expires_at, Date.now())).run()
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    maxAge: SESSION_MS / 1000,
  })
}

function sessionUser(c: Context): AuthUser | null {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  const row = db.select({ user: users, expires_at: sessions.expires_at }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.user_id))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expires_at, Date.now()), eq(users.active, 1))).get()
  return row ? publicUser(row.user) : null
}

// --- naive in-memory login throttle: 8 failures / 10 min per ip+username ---
const attempts = new Map<string, { n: number; until: number }>()
const throttleKey = (c: Context, u: string) => `${c.req.header('x-forwarded-for')?.split(',')[0] ?? 'local'}|${u}`
function checkThrottle(key: string) {
  const a = attempts.get(key)
  if (a && a.n >= 8 && a.until > Date.now()) fail(429, 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 10 นาที')
}
function recordFailure(key: string) {
  const a = attempts.get(key)
  const fresh = !a || a.until < Date.now()
  attempts.set(key, { n: fresh ? 1 : a!.n + 1, until: Date.now() + 10 * 60 * 1000 })
}

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const path = c.req.path
  if (c.req.method === 'OPTIONS' || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return next()
  const user = sessionUser(c) ?? fail(401, 'กรุณาเข้าสู่ระบบ')
  if (user.role !== 'owner') {
    if (OWNER_ONLY.some((r) => r.test(path))) fail(403, 'เฉพาะเจ้าของหอเท่านั้น')
    if (c.req.method !== 'GET' && OWNER_WRITE.some((r) => r.test(path))) fail(403, 'เฉพาะเจ้าของหอเท่านั้น')
  }
  c.set('user', user)
  return next()
}

export function registerAuth(app: Hono<AuthEnv>) {
  app.use('*', authMiddleware)

  app.get('/auth/status', (c) => {
    const hasUsers = !!db.select({ id: users.id }).from(users).limit(1).get()
    return c.json({ needs_setup: !hasUsers, user: sessionUser(c) })
  })

  // first-run: create the owner account (only when no users exist)
  app.post('/auth/setup', async (c) => {
    if (db.select({ id: users.id }).from(users).limit(1).get()) fail(403, 'ตั้งค่าบัญชีเจ้าของไปแล้ว')
    const b = await c.req.json()
    const username = validateCredentials(b.username, b.password)
    const name = String(b.name ?? '').trim() || username
    const u = db.insert(users).values({
      username, name, role: 'owner', password_hash: await Bun.password.hash(String(b.password)),
    }).returning().get()
    startSession(c, u.id)
    return c.json({ user: publicUser(u) }, 201)
  })

  app.post('/auth/login', async (c) => {
    const b = await c.req.json().catch(() => ({}))
    const username = String(b.username ?? '').trim().toLowerCase()
    const key = throttleKey(c, username)
    checkThrottle(key)
    const u = db.select().from(users).where(eq(users.username, username)).get()
    const ok = u && u.active === 1 && (await Bun.password.verify(String(b.password ?? ''), u.password_hash))
    if (!ok) {
      recordFailure(key)
      fail(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    }
    attempts.delete(key)
    startSession(c, u!.id)
    return c.json({ user: publicUser(u!) })
  })

  app.post('/auth/logout', (c) => {
    const token = getCookie(c, COOKIE)
    if (token) db.delete(sessions).where(eq(sessions.id, sha256(token))).run()
    deleteCookie(c, COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/auth/me', (c) => c.json({ user: c.get('user') }))

  app.put('/auth/password', async (c) => {
    const me = c.get('user')
    const b = await c.req.json()
    const u = db.select().from(users).where(eq(users.id, me.id)).get()!
    if (!(await Bun.password.verify(String(b.current ?? ''), u.password_hash))) fail(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง')
    const next = validatePassword(b.next)
    db.update(users).set({ password_hash: await Bun.password.hash(next) }).where(eq(users.id, me.id)).run()
    // sign out other devices, keep this one
    const token = getCookie(c, COOKIE)!
    db.delete(sessions).where(and(eq(sessions.user_id, me.id), ne(sessions.id, sha256(token)))).run()
    return c.json({ ok: true })
  })

  // ----- user management (owner only, enforced by middleware) -----
  const listCols = { id: users.id, username: users.username, name: users.name, role: users.role, active: users.active, last_login_at: users.last_login_at, created_at: users.created_at }
  app.get('/users', (c) => c.json(db.select(listCols).from(users).orderBy(asc(users.role), asc(users.username)).all()))

  app.post('/users', async (c) => {
    const b = await c.req.json()
    const username = validateCredentials(b.username, b.password)
    const role: Role = b.role === 'owner' ? 'owner' : 'staff'
    const u = db.insert(users).values({
      username, name: String(b.name ?? '').trim() || username, role, password_hash: await Bun.password.hash(String(b.password)),
    }).returning(listCols).get()
    return c.json(u, 201)
  })

  app.put('/users/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const me = c.get('user')
    const b = await c.req.json()
    const target = db.select().from(users).where(eq(users.id, id)).get() ?? fail(400, 'ไม่พบผู้ใช้')
    const role: Role = b.role === 'owner' ? 'owner' : 'staff'
    const active = b.active === false || b.active === 0 ? 0 : 1
    const demotesOwner = target.role === 'owner' && target.active === 1 && (role !== 'owner' || !active)
    if (demotesOwner && ownerCount() <= 1) fail(400, 'ต้องมีเจ้าของอย่างน้อย 1 บัญชี')
    if (id === me.id && !active) fail(400, 'ปิดบัญชีตัวเองไม่ได้')
    const patch: Partial<typeof users.$inferInsert> = { name: String(b.name ?? target.name).trim() || target.username, role, active }
    if (b.password) patch.password_hash = await Bun.password.hash(validatePassword(b.password))
    db.update(users).set(patch).where(eq(users.id, id)).run()
    if (!active || b.password) db.delete(sessions).where(eq(sessions.user_id, id)).run()
    return c.json(db.select(listCols).from(users).where(eq(users.id, id)).get())
  })

  app.delete('/users/:id', (c) => {
    const id = Number(c.req.param('id'))
    if (id === c.get('user').id) fail(400, 'ลบบัญชีตัวเองไม่ได้')
    const target = db.select().from(users).where(eq(users.id, id)).get()
    if (target?.role === 'owner' && target.active === 1 && ownerCount() <= 1) fail(400, 'ต้องมีเจ้าของอย่างน้อย 1 บัญชี')
    db.delete(users).where(eq(users.id, id)).run()
    return c.json({ ok: true })
  })
}
