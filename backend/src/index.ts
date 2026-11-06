import { and, asc, count, desc, eq, getTableColumns, lt, ne, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { registerAuth, type AuthEnv } from './auth'
import { currentMonth, db, getSettings, monthAdd } from './db'
import { requireTurnstile, turnstileSiteKey } from './turnstile'
import { bills, inquiries, rooms, settings, tenants, tickets } from './schema'

const app = new Hono<AuthEnv>().basePath('/api')
app.use('*', cors())

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  const msg = String((err as Error).message ?? err)
  if (msg.includes('UNIQUE')) return c.json({ error: 'ข้อมูลซ้ำกับที่มีอยู่แล้ว' }, 409)
  console.error(err)
  return c.json({ error: msg }, 500)
})

const bad = (msg: string): never => {
  throw new HTTPException(400, { message: msg })
}
const notFound = (msg = 'ไม่พบข้อมูล'): never => {
  throw new HTTPException(404, { message: msg })
}
const num = (v: unknown, def = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}
const idParam = (v: string) => Number(v) || notFound()
const today = () => new Date().toISOString().slice(0, 10)

registerAuth(app)

// ---------- reusable selections ----------
const roomStatus = sql<'occupied' | 'vacant' | 'maintenance'>`CASE WHEN ${tenants.id} IS NOT NULL THEN 'occupied' WHEN ${rooms.maintenance} = 1 THEN 'maintenance' ELSE 'vacant' END`
const roomsQuery = () =>
  db.select({
    ...getTableColumns(rooms),
    tenant_id: tenants.id,
    tenant_name: tenants.name,
    tenant_phone: tenants.phone,
    status: roomStatus,
  }).from(rooms).leftJoin(tenants, and(eq(tenants.room_id, rooms.id), eq(tenants.active, 1))).$dynamic()
const roomById = (id: number) => roomsQuery().where(eq(rooms.id, id)).get()

const outstandingSql = sql<number>`(SELECT COALESCE(SUM(${bills.total}),0) FROM ${bills} WHERE ${bills.tenant_id} = ${tenants.id} AND ${bills.status} = 'unpaid')`
const tenantsQuery = () =>
  db.select({ ...getTableColumns(tenants), room_number: rooms.number, room_rent: rooms.rent, outstanding: outstandingSql })
    .from(tenants).leftJoin(rooms, eq(rooms.id, tenants.room_id)).$dynamic()
const tenantById = (id: number) => tenantsQuery().where(eq(tenants.id, id)).get()

const billsQuery = () =>
  db.select({ ...getTableColumns(bills), room_number: rooms.number, floor: rooms.floor, tenant_name: tenants.name, tenant_phone: tenants.phone })
    .from(bills).innerJoin(rooms, eq(rooms.id, bills.room_id)).leftJoin(tenants, eq(tenants.id, bills.tenant_id)).$dynamic()
const billById = (id: number) => billsQuery().where(eq(bills.id, id)).get()

const ticketsQuery = () =>
  db.select({ ...getTableColumns(tickets), room_number: rooms.number }).from(tickets).leftJoin(rooms, eq(rooms.id, tickets.room_id)).$dynamic()
const ticketById = (id: number) => ticketsQuery().where(eq(tickets.id, id)).get()
const priorityOrder = sql`CASE ${tickets.priority} WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`

// ---------- settings ----------
app.get('/settings', (c) => c.json(getSettings()))
app.put('/settings', async (c) => {
  const b = await c.req.json()
  if (!b.name?.trim()) bad('กรุณาระบุชื่อหอพัก')
  db.update(settings).set({
    name: b.name.trim(), tagline: b.tagline ?? null, address: b.address ?? null, phone: b.phone ?? null, line_id: b.line_id ?? null,
    elec_rate: num(b.elec_rate, 7), water_rate: num(b.water_rate, 18), due_day: Math.min(28, Math.max(1, num(b.due_day, 5))),
    late_fee: num(b.late_fee), bank_name: b.bank_name ?? null, bank_account: b.bank_account ?? null, bank_holder: b.bank_holder ?? null,
  }).where(eq(settings.id, 1)).run()
  return c.json(getSettings())
})

// ---------- rooms ----------
const roomValues = (b: Record<string, unknown>) => {
  const number = String(b.number ?? '').trim()
  if (!number) bad('กรุณาระบุเลขห้อง')
  return {
    number, floor: num(b.floor, 1), type: String(b.type || 'สตูดิโอ'), size: num(b.size) || null,
    rent: num(b.rent), maintenance: b.maintenance ? 1 : 0, note: (b.note as string) ?? null,
  }
}
app.get('/rooms', (c) => c.json(roomsQuery().orderBy(asc(rooms.floor), asc(rooms.number)).all()))
app.post('/rooms', async (c) => {
  const r = db.insert(rooms).values(roomValues(await c.req.json())).returning({ id: rooms.id }).get()
  return c.json(roomById(r.id), 201)
})
app.put('/rooms/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  db.update(rooms).set(roomValues(await c.req.json())).where(eq(rooms.id, id)).run()
  return c.json(roomById(id) ?? notFound())
})
app.delete('/rooms/:id', (c) => {
  const id = idParam(c.req.param('id'))
  if (db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.room_id, id), eq(tenants.active, 1))).get())
    bad('ห้องนี้มีผู้เช่าอยู่ ต้องย้ายออกก่อน')
  db.transaction((tx) => {
    tx.update(tenants).set({ room_id: null }).where(eq(tenants.room_id, id)).run()
    tx.delete(rooms).where(eq(rooms.id, id)).run()
  })
  return c.json({ ok: true })
})

// ---------- tenants ----------
app.get('/tenants', (c) => {
  const active = c.req.query('active')
  const q = tenantsQuery()
  if (active !== 'all') q.where(eq(tenants.active, active === '0' ? 0 : 1))
  return c.json(q.orderBy(desc(tenants.active), asc(rooms.number)).all())
})
app.post('/tenants', async (c) => {
  const b = await c.req.json()
  if (!b.name?.trim()) bad('กรุณาระบุชื่อผู้เช่า')
  const room = roomById(num(b.room_id)) ?? bad('กรุณาเลือกห้อง')
  if (room.status !== 'vacant') bad(`ห้อง ${room.number} ไม่ว่าง`)
  const r = db.insert(tenants).values({
    name: b.name.trim(), phone: b.phone || null, line_id: b.line_id || null, room_id: room.id,
    move_in: b.move_in || today(), deposit: num(b.deposit), elec_start: num(b.elec_start), water_start: num(b.water_start), note: b.note || null,
  }).returning({ id: tenants.id }).get()
  return c.json(tenantById(r.id), 201)
})
app.put('/tenants/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await c.req.json()
  if (!b.name?.trim()) bad('กรุณาระบุชื่อผู้เช่า')
  db.update(tenants).set({ name: b.name.trim(), phone: b.phone || null, line_id: b.line_id || null, deposit: num(b.deposit), note: b.note || null })
    .where(eq(tenants.id, id)).run()
  return c.json(tenantById(id) ?? notFound())
})
app.post('/tenants/:id/move-out', async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await c.req.json().catch(() => ({}))
  db.update(tenants).set({ active: 0, move_out: b.date || today() }).where(eq(tenants.id, id)).run()
  return c.json(tenantById(id) ?? notFound())
})

// ---------- meter & bills ----------
function lastReading(roomId: number, month: string, start: { elec_start: number; water_start: number }) {
  const prev = db.select({ elec: bills.elec_curr, water: bills.water_curr }).from(bills)
    .where(and(eq(bills.room_id, roomId), lt(bills.month, month))).orderBy(desc(bills.month)).limit(1).get()
  return prev ?? { elec: start.elec_start, water: start.water_start }
}
const findBill = (roomId: number, month: string) =>
  db.select().from(bills).where(and(eq(bills.room_id, roomId), eq(bills.month, month))).get()
const occupiedRooms = () =>
  db.select({
    room_id: rooms.id, number: rooms.number, floor: rooms.floor, rent: rooms.rent,
    tenant_id: tenants.id, tenant_name: tenants.name, elec_start: tenants.elec_start, water_start: tenants.water_start,
  }).from(rooms).innerJoin(tenants, and(eq(tenants.room_id, rooms.id), eq(tenants.active, 1))).$dynamic()

app.get('/meter', (c) => {
  const month = c.req.query('month') || currentMonth()
  const rows = occupiedRooms().orderBy(asc(rooms.floor), asc(rooms.number)).all()
  return c.json(rows.map((row) => {
    const bill = findBill(row.room_id, month) ?? null
    const prev = lastReading(row.room_id, month, row)
    return { ...row, elec_prev: bill?.elec_prev ?? prev.elec, water_prev: bill?.water_prev ?? prev.water, bill }
  }))
})

app.post('/bills/batch', async (c) => {
  const { month, items } = await c.req.json()
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) bad('รูปแบบเดือนไม่ถูกต้อง')
  if (!Array.isArray(items) || !items.length) bad('ไม่มีรายการ')
  const s = getSettings()
  let created = 0, updated = 0
  const errors: string[] = []
  db.transaction((tx) => {
    for (const it of items) {
      const row = occupiedRooms().where(eq(rooms.id, num(it.room_id))).get()
      if (!row) continue
      const existing = findBill(row.room_id, month)
      if (existing?.status === 'paid') { errors.push(`ห้อง ${row.number}: ชำระแล้ว แก้ไขไม่ได้`); continue }
      const prev = existing ? { elec: existing.elec_prev, water: existing.water_prev } : lastReading(row.room_id, month, row)
      const ec = num(it.elec_curr, NaN), wc = num(it.water_curr, NaN)
      if (!Number.isFinite(ec) || !Number.isFinite(wc)) continue
      if (ec < prev.elec || wc < prev.water) { errors.push(`ห้อง ${row.number}: เลขมิเตอร์น้อยกว่าครั้งก่อน`); continue }
      const other = num(it.other)
      const total = Math.round((row.rent + (ec - prev.elec) * s.elec_rate + (wc - prev.water) * s.water_rate + other) * 100) / 100
      const values = {
        rent: row.rent, elec_curr: ec, water_curr: wc, elec_rate: s.elec_rate, water_rate: s.water_rate,
        other, other_note: it.other_note || null, total,
      }
      if (existing) {
        tx.update(bills).set(values).where(eq(bills.id, existing.id)).run()
        updated++
      } else {
        tx.insert(bills).values({ ...values, room_id: row.room_id, tenant_id: row.tenant_id, month, elec_prev: prev.elec, water_prev: prev.water }).run()
        created++
      }
    }
  })
  return c.json({ created, updated, errors })
})

app.get('/bills', (c) => {
  const { month, status, tenant_id } = c.req.query()
  const cond: SQL[] = []
  if (month) cond.push(eq(bills.month, month))
  if (status === 'paid' || status === 'unpaid') cond.push(eq(bills.status, status))
  if (tenant_id) cond.push(eq(bills.tenant_id, num(tenant_id)))
  return c.json(billsQuery().where(and(...cond)).orderBy(desc(bills.month), asc(rooms.floor), asc(rooms.number)).all())
})
app.get('/bills/:id', (c) => c.json(billById(idParam(c.req.param('id'))) ?? notFound('ไม่พบบิล')))
app.post('/bills/:id/pay', async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await c.req.json().catch(() => ({}))
  db.update(bills).set({ status: 'paid', paid_at: b.paid_at || new Date().toISOString(), method: b.method || 'transfer' }).where(eq(bills.id, id)).run()
  return c.json(billById(id) ?? notFound('ไม่พบบิล'))
})
app.post('/bills/:id/unpay', (c) => {
  const id = idParam(c.req.param('id'))
  db.update(bills).set({ status: 'unpaid', paid_at: null, method: null }).where(eq(bills.id, id)).run()
  return c.json(billById(id) ?? notFound('ไม่พบบิล'))
})
app.delete('/bills/:id', (c) => {
  const id = idParam(c.req.param('id'))
  if (db.select({ s: bills.status }).from(bills).where(eq(bills.id, id)).get()?.s === 'paid') bad('บิลที่ชำระแล้วลบไม่ได้')
  db.delete(bills).where(eq(bills.id, id)).run()
  return c.json({ ok: true })
})

// ---------- tickets ----------
const ticketValues = (b: Record<string, unknown>) => {
  const title = String(b.title ?? '').trim()
  if (!title) bad('กรุณาระบุหัวข้อ')
  const priority = (['high', 'normal', 'low'] as const).find((p) => p === b.priority) ?? 'normal'
  return { room_id: num(b.room_id) || null, title, detail: (b.detail as string) || null, priority }
}
app.get('/tickets', (c) => c.json(ticketsQuery().orderBy(
  sql`CASE ${tickets.status} WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END`, priorityOrder, desc(tickets.created_at)).all()))
app.post('/tickets', async (c) => {
  const r = db.insert(tickets).values(ticketValues(await c.req.json())).returning({ id: tickets.id }).get()
  return c.json(ticketById(r.id), 201)
})
app.put('/tickets/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await c.req.json()
  const status = (['open', 'in_progress', 'done'] as const).find((s) => s === b.status) ?? 'open'
  db.update(tickets).set({ ...ticketValues(b), status, cost: num(b.cost), updated_at: sql`(datetime('now'))` }).where(eq(tickets.id, id)).run()
  return c.json(ticketById(id) ?? notFound())
})
app.delete('/tickets/:id', (c) => {
  db.delete(tickets).where(eq(tickets.id, idParam(c.req.param('id')))).run()
  return c.json({ ok: true })
})

// ---------- inquiries ----------
app.get('/inquiries', (c) => c.json(db.select().from(inquiries).orderBy(
  sql`CASE ${inquiries.status} WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END`, desc(inquiries.created_at)).all()))
app.put('/inquiries/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await c.req.json()
  const status = (['new', 'contacted', 'closed'] as const).find((s) => s === b.status) ?? bad('สถานะไม่ถูกต้อง')
  return c.json(db.update(inquiries).set({ status }).where(eq(inquiries.id, id)).returning().get() ?? notFound())
})
app.delete('/inquiries/:id', (c) => {
  db.delete(inquiries).where(eq(inquiries.id, idParam(c.req.param('id')))).run()
  return c.json({ ok: true })
})

// ---------- public (landing page) ----------
app.get('/public', (c) => {
  const s = getSettings()
  const all = roomsQuery().orderBy(asc(rooms.floor), asc(rooms.number)).all()
  const typeMap = new Map<string, { type: string; size: number; min_rent: number; total: number; vacant: number }>()
  for (const r of all) {
    const t = typeMap.get(r.type) ?? { type: r.type, size: r.size ?? 0, min_rent: Infinity, total: 0, vacant: 0 }
    t.total++
    t.min_rent = Math.min(t.min_rent, r.rent)
    if (r.status === 'vacant') t.vacant++
    typeMap.set(r.type, t)
  }
  return c.json({
    name: s.name, tagline: s.tagline, address: s.address, phone: s.phone, line_id: s.line_id,
    elec_rate: s.elec_rate, water_rate: s.water_rate,
    types: [...typeMap.values()].sort((a, b) => a.min_rent - b.min_rent),
    vacant_rooms: all.filter((r) => r.status === 'vacant').map((r) => ({ number: r.number, floor: r.floor, type: r.type, size: r.size, rent: r.rent })),
    total_rooms: all.length,
    building: all.map((r) => ({ number: r.number, floor: r.floor, vacant: r.status === 'vacant' })),
    turnstile_site_key: turnstileSiteKey,
  })
})
app.post('/public/inquiries', async (c) => {
  const b = await c.req.json()
  if (!b.name?.trim()) bad('กรุณากรอกชื่อ')
  if (!/^[0-9+\-\s]{9,15}$/.test(b.phone ?? '')) bad('กรุณากรอกเบอร์โทรให้ถูกต้อง')
  await requireTurnstile(c, b.turnstile_token)
  db.insert(inquiries).values({
    name: b.name.trim().slice(0, 100), phone: b.phone.trim(), room_type: b.room_type || null,
    move_in: b.move_in || null, message: String(b.message ?? '').slice(0, 1000) || null,
  }).run()
  return c.json({ ok: true }, 201)
})

// ---------- dashboard ----------
const monthTotals = (month: string) =>
  db.select({
    bills: count(),
    billed: sql<number>`COALESCE(SUM(${bills.total}),0)`,
    collected: sql<number>`COALESCE(SUM(CASE WHEN ${bills.status}='paid' THEN ${bills.total} END),0)`,
    unpaid_count: sql<number>`COALESCE(SUM(CASE WHEN ${bills.status}='unpaid' THEN 1 END),0)`,
    elec_units: sql<number>`COALESCE(SUM(${bills.elec_curr}-${bills.elec_prev}),0)`,
    water_units: sql<number>`COALESCE(SUM(${bills.water_curr}-${bills.water_prev}),0)`,
  }).from(bills).where(eq(bills.month, month)).get()!

app.get('/dashboard', (c) => {
  const month = c.req.query('month') || currentMonth()
  const all = roomsQuery().all()
  const countStatus = (s: string) => all.filter((r) => r.status === s).length
  const { elec_units: _e, water_units: _w, ...month_summary } = monthTotals(month)
  const outstanding = db.select({ amount: sql<number>`COALESCE(SUM(${bills.total}),0)`, count: count() })
    .from(bills).where(eq(bills.status, 'unpaid')).get()
  const trend = Array.from({ length: 6 }, (_, i) => monthAdd(month, i - 5)).map((m) => {
    const { billed, collected, elec_units, water_units } = monthTotals(m)
    return { month: m, billed, collected, elec_units, water_units }
  })
  const metered = occupiedRooms().innerJoin(bills, and(eq(bills.room_id, rooms.id), eq(bills.month, month))).all().length
  return c.json({
    month,
    rooms: { total: all.length, occupied: countStatus('occupied'), vacant: countStatus('vacant'), maintenance: countStatus('maintenance') },
    month_summary,
    outstanding,
    trend,
    overdue: billsQuery().where(eq(bills.status, 'unpaid')).orderBy(asc(bills.month), asc(rooms.number)).limit(8).all(),
    tickets: ticketsQuery().where(ne(tickets.status, 'done')).orderBy(priorityOrder, desc(tickets.created_at)).limit(5).all(),
    new_inquiries: db.select({ n: count() }).from(inquiries).where(eq(inquiries.status, 'new')).get()!.n,
    meter_pending: countStatus('occupied') - metered,
  })
})

export default { port: Number(process.env.PORT ?? 3000), fetch: app.fetch }
