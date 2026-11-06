import { api, type Inquiry } from '../../lib/api'
import { dateLabel, relTime } from '../../lib/format'
import { Badge, Empty, Icon, Loading, useFetch, useToast } from '../../lib/ui'

const STATUS = {
  new: { label: 'ใหม่', tone: 'blue' },
  contacted: { label: 'ติดต่อแล้ว', tone: 'amber' },
  closed: { label: 'ปิดแล้ว', tone: 'gray' },
} as const

export default function Inquiries() {
  const { data, loading, reload } = useFetch<Inquiry[]>('/inquiries')
  const toast = useToast()
  async function setStatus(i: Inquiry, status: Inquiry['status']) {
    try { await api.put(`/inquiries/${i.id}`, { status }); reload() } catch (e) { toast((e as Error).message, 'err') }
  }
  async function remove(i: Inquiry) {
    if (!confirm(`ลบรายการของ ${i.name}?`)) return
    await api.del(`/inquiries/${i.id}`)
    toast('ลบแล้ว')
    reload()
  }
  if (!data) return loading ? <Loading /> : <Empty>โหลดข้อมูลไม่สำเร็จ</Empty>
  return (
    <div className="stack">
      <p className="muted">รายชื่อผู้กรอกฟอร์ม “นัดดูห้อง” จากหน้าเว็บไซต์ <a className="link" href="#/" target="_blank">เปิดหน้าเว็บ ↗</a></p>
      {data.length === 0 ? <Empty>ยังไม่มีผู้สนใจ</Empty> : (
        <div className="inq-grid">
          {data.map((i) => (
            <article key={i.id} className={`card inq-card inq-${i.status}`}>
              <header className="row between">
                <div><h3>{i.name}</h3><small className="muted">{relTime(i.created_at)}</small></div>
                <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
              </header>
              <dl className="inq-dl">
                <div><dt>ห้องที่สนใจ</dt><dd>{i.room_type ?? '-'}</dd></div>
                <div><dt>วันเข้าอยู่</dt><dd>{dateLabel(i.move_in)}</dd></div>
              </dl>
              {i.message && <p className="inq-msg">“{i.message}”</p>}
              <footer className="row gap-sm wrap">
                <a className="btn btn-sm btn-primary" href={`tel:${i.phone}`} onClick={() => i.status === 'new' && setStatus(i, 'contacted')}>
                  <Icon name="phone" size={15} />{i.phone}
                </a>
                {i.status !== 'contacted' && <button className="btn btn-sm btn-ghost" onClick={() => setStatus(i, 'contacted')}>ติดต่อแล้ว</button>}
                {i.status !== 'closed' && <button className="btn btn-sm btn-ghost" onClick={() => setStatus(i, 'closed')}>ปิดรายการ</button>}
                <button className="icon-btn ml-auto" onClick={() => remove(i)} aria-label="ลบ"><Icon name="trash" size={16} /></button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
