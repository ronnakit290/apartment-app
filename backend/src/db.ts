import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'
import { bills, inquiries, rooms, settings, tenants, tickets } from './schema'

const sqlite = new Database(process.env.DB_PATH ?? 'data.sqlite', { create: true })
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

export const db = drizzle(sqlite, { schema })
migrate(db, { migrationsFolder: `${import.meta.dir}/../drizzle` })

export function monthAdd(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

if (!db.select({ id: settings.id }).from(settings).get()) seed()

function seed() {
  let s = 20261106
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ')

  db.transaction((tx) => {
    tx.insert(settings).values({
      id: 1,
      name: 'Nisia Residence',
      tagline: 'อพาร์ทเมนท์ใหม่ เงียบสงบ ใกล้รถไฟฟ้า เดินทางสะดวก',
      address: '88/8 ถ.พหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400',
      phone: '081-234-5678',
      line_id: '@nisiaresidence',
      bank_name: 'กสิกรไทย',
      bank_account: '123-4-56789-0',
      bank_holder: 'บจก. นิเซีย เรสซิเดนซ์',
    }).run()

    const layout = [
      { type: 'สตูดิโอ', size: 24, rent: 4500 },
      { type: 'สตูดิโอ', size: 24, rent: 4500 },
      { type: 'ดีลักซ์', size: 30, rent: 5500 },
      { type: 'ดีลักซ์', size: 30, rent: 5500 },
      { type: 'สตูดิโอ', size: 24, rent: 4500 },
      { type: 'สตูดิโอ', size: 24, rent: 4500 },
      { type: 'ดีลักซ์', size: 30, rent: 5500 },
      { type: 'สวีท', size: 42, rent: 8500 },
    ]
    const roomRows: { id: number; rent: number }[] = []
    for (let f = 2; f <= 4; f++)
      layout.forEach((t, i) => {
        roomRows.push(tx.insert(rooms).values({
          number: `${f}0${i + 1}`, floor: f, type: t.type, size: t.size,
          rent: t.rent + (f - 2) * 200, maintenance: f === 3 && i === 5 ? 1 : 0,
        }).returning({ id: rooms.id, rent: rooms.rent }).get())
      })

    const names = [
      'สมชาย ใจดี', 'วรรณา ศรีสุข', 'ณัฐพล มั่นคง', 'กมลชนก ทองดี', 'ธีรวัฒน์ แก้วใส', 'พิมพ์ชนก รุ่งเรือง',
      'อนุชา บุญมา', 'ศิริพร เพชรงาม', 'ปิยะ สายทอง', 'จิราพร สุขใจ', 'ภาณุ วงศ์ไทย', 'สุดารัตน์ ชัยมงคล',
      'กิตติ ศักดิ์ดี', 'มณีรัตน์ อินทร์แก้ว', 'วิทยา ทรัพย์มาก', 'อรอุมา นาคสวัสดิ์', 'ชยพล ปัญญาดี', 'ลลิตา ภูมิใจ',
    ]
    const occupied = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 20, 22]
    const cm = currentMonth()
    occupied.forEach((ri, k) => {
      const room = roomRows[ri]
      let elec = Math.round(1000 + rnd() * 4000)
      let water = Math.round(100 + rnd() * 400)
      const tenant = tx.insert(tenants).values({
        name: names[k],
        phone: `08${Math.floor(rnd() * 9) + 1}-${Math.floor(rnd() * 900) + 100}-${Math.floor(rnd() * 9000) + 1000}`,
        line_id: k % 3 === 0 ? `line_${k + 1}` : null,
        room_id: room.id,
        move_in: `${monthAdd(cm, -6 - Math.floor(rnd() * 12))}-01`,
        deposit: room.rent * 2,
        elec_start: elec,
        water_start: water,
      }).returning({ id: tenants.id }).get()

      for (let back = 6; back >= 1; back--) {
        const m = monthAdd(cm, -back)
        const eu = Math.round(80 + rnd() * 180)
        const wu = Math.round(4 + rnd() * 8)
        const paid = back > 1 || rnd() > 0.3
        const [y, mo] = m.split('-').map(Number)
        tx.insert(bills).values({
          room_id: room.id, tenant_id: tenant.id, month: m, rent: room.rent,
          elec_prev: elec, elec_curr: elec + eu, elec_rate: 7,
          water_prev: water, water_curr: water + wu, water_rate: 18,
          total: room.rent + eu * 7 + wu * 18,
          status: paid ? 'paid' : 'unpaid',
          paid_at: paid ? new Date(Date.UTC(y, mo, 1 + Math.floor(rnd() * 6))).toISOString() : null,
          method: paid ? (rnd() > 0.4 ? 'transfer' : 'cash') : null,
        }).run()
        elec += eu
        water += wu
      }
    })

    tx.insert(tickets).values([
      { room_id: roomRows[13].id, title: 'แอร์ไม่เย็น มีน้ำหยด', detail: 'ผู้เช่าแจ้งว่าแอร์มีน้ำหยดตั้งแต่เมื่อวาน', priority: 'high', status: 'open', created_at: ago(1) },
      { room_id: roomRows[2].id, title: 'ก๊อกน้ำห้องน้ำรั่ว', priority: 'normal', status: 'in_progress', cost: 350, created_at: ago(3) },
      { room_id: roomRows[8].id, title: 'หลอดไฟหน้าห้องขาด', priority: 'low', status: 'open', created_at: ago(2) },
      { room_id: roomRows[16].id, title: 'ประตูห้องน้ำปิดไม่สนิท', detail: 'ต้องเปลี่ยนบานพับ', priority: 'normal', status: 'done', cost: 600, created_at: ago(12) },
      { room_id: roomRows[0].id, title: 'ทำความสะอาดแอร์ประจำปี', priority: 'low', status: 'done', cost: 500, created_at: ago(20) },
    ]).run()

    tx.insert(inquiries).values([
      { name: 'ปวีณา ใจงาม', phone: '089-111-2233', room_type: 'ดีลักซ์', move_in: `${monthAdd(cm, 1)}-01`, message: 'สนใจห้องชั้น 3 ขอนัดดูห้องวันเสาร์ค่ะ', created_at: ago(0) },
      { name: 'Kenji Tanaka', phone: '062-555-0101', room_type: 'สวีท', move_in: `${monthAdd(cm, 1)}-15`, message: 'Do you allow small pets?', created_at: ago(1) },
      { name: 'ธนากร พูลผล', phone: '091-777-8899', room_type: 'สตูดิโอ', move_in: `${cm}-20`, status: 'contacted', created_at: ago(4) },
    ]).run()
  })
}

export const getSettings = () => db.select().from(settings).where(eq(settings.id, 1)).get()!
