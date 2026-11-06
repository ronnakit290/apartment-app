import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { api, type Room } from '../../lib/api'
import { baht } from '../../lib/format'
import { Badge, Empty, Field, Icon, Loading, Modal, useFetch, useToast } from '../../lib/ui'
import { ROOM_STATUS } from './shared'
import { MoveInModal } from './Tenants'

type Filter = 'all' | Room['status']

export default function Rooms() {
  const { data, loading, reload } = useFetch<Room[]>('/rooms')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Partial<Room> | null>(null)
  const [moveIn, setMoveIn] = useState<Room | null>(null)

  const floors = useMemo(() => {
    const m = new Map<number, Room[]>()
    ;(data ?? []).filter((r) => filter === 'all' || r.status === filter)
      .forEach((r) => m.set(r.floor, [...(m.get(r.floor) ?? []), r]))
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [data, filter])

  if (!data) return loading ? <Loading /> : <Empty>โหลดข้อมูลไม่สำเร็จ</Empty>
  const counts = { all: data.length, occupied: 0, vacant: 0, maintenance: 0 }
  data.forEach((r) => counts[r.status]++)

  return (
    <div className="stack">
      <div className="page-head">
        <div className="tabs">
          {(['all', 'vacant', 'occupied', 'maintenance'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'ทั้งหมด' : ROOM_STATUS[f].label} <span className="count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ floor: 2, type: 'สตูดิโอ', rent: 4500, size: 24 })}><Icon name="plus" />เพิ่มห้อง</button>
      </div>

      {floors.length === 0 && <Empty>ไม่มีห้องในหมวดนี้</Empty>}
      {floors.map(([floor, rooms]) => (
        <section key={floor}>
          <h3 className="floor-title">ชั้น {floor}</h3>
          <div className="room-grid">
            {rooms.map((r, i) => (
              <motion.article key={r.id} className={`room-card room-${r.status}`} layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.25) }}>
                <header>
                  <strong className="room-no">{r.number}</strong>
                  <Badge tone={ROOM_STATUS[r.status].tone}>{ROOM_STATUS[r.status].label}</Badge>
                </header>
                <p className="room-meta">{r.type} · {r.size ?? '-'} ตร.ม.</p>
                <p className="room-rent">{baht(r.rent)}<small>/ด.</small></p>
                <p className="room-tenant">{r.tenant_name ? <><Icon name="users" size={14} />{r.tenant_name}</> : <span className="muted">—</span>}</p>
                <footer>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(r)}><Icon name="edit" size={15} />แก้ไข</button>
                  {r.status === 'vacant' && <button className="btn btn-sm btn-primary" onClick={() => setMoveIn(r)}>ย้ายเข้า</button>}
                </footer>
              </motion.article>
            ))}
          </div>
        </section>
      ))}

      {editing && <RoomModal room={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      {moveIn && <MoveInModal rooms={[moveIn]} onClose={() => setMoveIn(null)} onSaved={() => { setMoveIn(null); reload() }} />}
    </div>
  )
}

function RoomModal({ room, onClose, onSaved }: { room: Partial<Room>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    number: room.number ?? '', floor: room.floor ?? 1, type: room.type ?? 'สตูดิโอ', size: room.size ?? '',
    rent: room.rent ?? 0, maintenance: !!room.maintenance, note: room.note ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  async function save() {
    setBusy(true)
    try {
      if (room.id) await api.put(`/rooms/${room.id}`, f)
      else await api.post('/rooms', f)
      toast(room.id ? 'บันทึกห้องแล้ว' : 'เพิ่มห้องแล้ว')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  async function remove() {
    if (!confirm(`ลบห้อง ${room.number}? บิลของห้องนี้จะถูกลบด้วย`)) return
    try {
      await api.del(`/rooms/${room.id}`)
      toast('ลบห้องแล้ว')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <Modal title={room.id ? `แก้ไขห้อง ${room.number}` : 'เพิ่มห้องใหม่'} onClose={onClose}
      footer={<>
        {room.id && <button className="btn btn-danger-ghost mr-auto" onClick={remove}><Icon name="trash" size={16} />ลบ</button>}
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>บันทึก</button>
      </>}>
      <div className="grid-2">
        <Field label="เลขห้อง"><input value={f.number} onChange={set('number')} autoFocus /></Field>
        <Field label="ชั้น"><input type="number" value={f.floor} onChange={set('floor')} /></Field>
        <Field label="ประเภท">
          <select value={f.type} onChange={set('type')}>{['สตูดิโอ', 'ดีลักซ์', 'สวีท'].map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="ขนาด (ตร.ม.)"><input type="number" value={f.size} onChange={set('size')} /></Field>
        <Field label="ค่าเช่า / เดือน (บาท)"><input type="number" value={f.rent} onChange={set('rent')} /></Field>
        <Field label="หมายเหตุ"><input value={f.note} onChange={set('note')} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={f.maintenance} onChange={set('maintenance')} />ปิดปรับปรุง (ไม่แสดงเป็นห้องว่าง)</label>
    </Modal>
  )
}
