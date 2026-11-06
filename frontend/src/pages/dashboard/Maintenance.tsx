import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useState } from 'react'
import { api, type Room, type Ticket } from '../../lib/api'
import { baht, relTime } from '../../lib/format'
import { Badge, Empty, Field, Icon, Loading, Modal, useFetch, useToast } from '../../lib/ui'
import { PRIORITY } from './shared'

const COLS = [
  { key: 'open', label: 'รอดำเนินการ' },
  { key: 'in_progress', label: 'กำลังซ่อม' },
  { key: 'done', label: 'เสร็จแล้ว' },
] as const
const NEXT: Record<Ticket['status'], Ticket['status'] | null> = { open: 'in_progress', in_progress: 'done', done: null }

export default function Maintenance() {
  const { data, loading, reload } = useFetch<Ticket[]>('/tickets')
  const rooms = useFetch<Room[]>('/rooms')
  const [editing, setEditing] = useState<Partial<Ticket> | null>(null)
  const toast = useToast()

  async function move(t: Ticket, status: Ticket['status']) {
    try {
      await api.put(`/tickets/${t.id}`, { ...t, status })
      toast(status === 'done' ? 'ปิดงานซ่อมแล้ว' : 'อัปเดตสถานะแล้ว')
      reload()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  if (!data) return loading ? <Loading /> : <Empty>โหลดข้อมูลไม่สำเร็จ</Empty>
  const cost = data.filter((t) => t.status === 'done').reduce((s, t) => s + t.cost, 0)

  return (
    <div className="stack">
      <div className="page-head">
        <span className="muted">ค่าซ่อมที่ปิดงานแล้วรวม {baht(cost)}</span>
        <button className="btn btn-primary" onClick={() => setEditing({ priority: 'normal', status: 'open' })}><Icon name="plus" />แจ้งซ่อม</button>
      </div>
      <LayoutGroup><div className="kanban">
        {COLS.map((col) => {
          const items = data.filter((t) => t.status === col.key)
          return (
            <section key={col.key} className={`kcol kcol-${col.key}`}>
              <header><h3>{col.label}</h3><span className="count">{items.length}</span></header>
              {items.length === 0 && <p className="kempty">ไม่มีรายการ</p>}
              <AnimatePresence mode="popLayout">
              {items.map((t) => (
                <motion.article key={t.id} layoutId={`ticket-${t.id}`} className="kcard" onClick={() => setEditing(t)}
                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }} whileHover={{ y: -2 }}>
                  <div className="row between">
                    <span className="room-chip">{t.room_number ?? 'ส่วนกลาง'}</span>
                    <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
                  </div>
                  <h4>{t.title}</h4>
                  {t.detail && <p className="muted">{t.detail}</p>}
                  <div className="row between">
                    <small className="muted">{relTime(t.created_at)}{t.cost > 0 && ` · ${baht(t.cost)}`}</small>
                    {NEXT[t.status] && (
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); move(t, NEXT[t.status]!) }}>
                        {t.status === 'open' ? 'เริ่มซ่อม' : 'เสร็จแล้ว'}<Icon name="chevR" size={14} />
                      </button>
                    )}
                  </div>
                </motion.article>
              ))}
              </AnimatePresence>
            </section>
          )
        })}
      </div></LayoutGroup>
      {editing && <TicketModal ticket={editing} rooms={rooms.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function TicketModal({ ticket, rooms, onClose, onSaved }: { ticket: Partial<Ticket>; rooms: Room[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    room_id: ticket.room_id ?? '', title: ticket.title ?? '', detail: ticket.detail ?? '',
    priority: ticket.priority ?? 'normal', status: ticket.status ?? 'open', cost: ticket.cost ?? 0,
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  async function save() {
    try {
      if (ticket.id) await api.put(`/tickets/${ticket.id}`, f)
      else await api.post('/tickets', f)
      toast('บันทึกงานซ่อมแล้ว')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') }
  }
  async function remove() {
    if (!confirm('ลบรายการแจ้งซ่อมนี้?')) return
    await api.del(`/tickets/${ticket.id}`)
    toast('ลบแล้ว')
    onSaved()
  }
  return (
    <Modal title={ticket.id ? 'รายละเอียดงานซ่อม' : 'แจ้งซ่อมใหม่'} onClose={onClose}
      footer={<>
        {ticket.id && <button className="btn btn-danger-ghost mr-auto" onClick={remove}><Icon name="trash" size={16} />ลบ</button>}
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save}>บันทึก</button>
      </>}>
      <Field label="หัวข้อ *"><input value={f.title} onChange={set('title')} autoFocus placeholder="เช่น แอร์ไม่เย็น" /></Field>
      <div className="grid-2">
        <Field label="ห้อง">
          <select value={f.room_id} onChange={set('room_id')}>
            <option value="">ส่วนกลาง</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.number}{r.tenant_name ? ` · ${r.tenant_name}` : ''}</option>)}
          </select>
        </Field>
        <Field label="ความเร่งด่วน">
          <select value={f.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        {ticket.id && <Field label="สถานะ">
          <select value={f.status} onChange={set('status')}>{COLS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        </Field>}
        {ticket.id && <Field label="ค่าใช้จ่าย (บาท)"><input type="number" value={f.cost} onChange={set('cost')} /></Field>}
      </div>
      <Field label="รายละเอียด"><textarea rows={3} value={f.detail} onChange={set('detail')} /></Field>
    </Modal>
  )
}
