import { useMemo, useState } from 'react'
import { api, type Bill, type Room, type Tenant } from '../../lib/api'
import { baht, dateLabel, monthLabel } from '../../lib/format'
import { Badge, Empty, Field, Icon, Loading, Modal, useFetch, useToast } from '../../lib/ui'

export default function Tenants() {
  const [tab, setTab] = useState<'1' | '0'>('1')
  const { data, loading, reload } = useFetch<Tenant[]>(`/tenants?active=${tab}`)
  const rooms = useFetch<Room[]>('/rooms')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<Tenant | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data ?? []).filter((t) => !s || [t.name, t.phone, t.room_number].some((v) => v?.toLowerCase().includes(s)))
  }, [data, q])
  const vacant = (rooms.data ?? []).filter((r) => r.status === 'vacant')

  return (
    <div className="stack">
      <div className="page-head">
        <div className="tabs">
          <button className={tab === '1' ? 'active' : ''} onClick={() => setTab('1')}>กำลังเช่า</button>
          <button className={tab === '0' ? 'active' : ''} onClick={() => setTab('0')}>ย้ายออกแล้ว</button>
        </div>
        <div className="row gap-sm">
          <label className="search"><Icon name="search" size={16} /><input placeholder="ค้นหาชื่อ เบอร์ ห้อง" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={() => setAdding(true)} disabled={!vacant.length} title={vacant.length ? '' : 'ไม่มีห้องว่าง'}>
            <Icon name="plus" />เพิ่มผู้เช่า
          </button>
        </div>
      </div>

      <div className="card card-flush">
        {!data ? <Loading /> : list.length === 0 ? <Empty>{loading ? 'กำลังโหลด…' : 'ไม่พบผู้เช่า'}</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ห้อง</th><th>ชื่อ</th><th>ติดต่อ</th><th>วันที่เข้า</th><th className="num">เงินประกัน</th><th className="num">ค้างชำระ</th><th /></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} onClick={() => setView(t)} className="clickable">
                    <td><span className="room-chip">{t.room_number ?? '—'}</span></td>
                    <td><b>{t.name}</b>{t.note && <small className="block muted">{t.note}</small>}</td>
                    <td>{t.phone ?? '-'}{t.line_id && <small className="block muted">LINE: {t.line_id}</small>}</td>
                    <td>{dateLabel(t.move_in)}{t.move_out && <small className="block muted">ออก {dateLabel(t.move_out)}</small>}</td>
                    <td className="num">{baht(t.deposit)}</td>
                    <td className="num">{t.outstanding > 0 ? <Badge tone="red">{baht(t.outstanding)}</Badge> : <span className="muted">—</span>}</td>
                    <td className="num"><Icon name="chevR" size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <MoveInModal rooms={vacant} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); rooms.reload() }} />}
      {view && <TenantModal tenant={view} onClose={() => setView(null)} onSaved={() => { setView(null); reload(); rooms.reload() }} />}
    </div>
  )
}

export function MoveInModal({ rooms, onClose, onSaved }: { rooms: Room[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const first = rooms[0]
  const [f, setF] = useState({
    name: '', phone: '', line_id: '', room_id: first?.id ?? 0, move_in: new Date().toISOString().slice(0, 10),
    deposit: (first?.rent ?? 0) * 2, elec_start: 0, water_start: 0, note: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value
    if (k === 'room_id') {
      const r = rooms.find((x) => x.id === Number(v))
      setF({ ...f, room_id: Number(v), deposit: (r?.rent ?? 0) * 2 })
    } else setF({ ...f, [k]: v })
  }
  async function save() {
    setBusy(true)
    try {
      await api.post('/tenants', f)
      toast('เพิ่มผู้เช่าเรียบร้อย')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="ทำสัญญาเช่า / ย้ายเข้า" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" disabled={busy} onClick={save}>บันทึกผู้เช่า</button></>}>
      <div className="grid-2">
        <Field label="ชื่อ-นามสกุล *"><input value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="ห้อง *">
          <select value={f.room_id} onChange={set('room_id')}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.type} · {baht(r.rent)}</option>)}
          </select>
        </Field>
        <Field label="เบอร์โทร"><input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="LINE ID"><input value={f.line_id} onChange={set('line_id')} /></Field>
        <Field label="วันที่เข้าอยู่"><input type="date" value={f.move_in} onChange={set('move_in')} /></Field>
        <Field label="เงินประกัน (บาท)"><input type="number" value={f.deposit} onChange={set('deposit')} /></Field>
        <Field label="มิเตอร์ไฟเริ่มต้น" hint="เลขบนมิเตอร์วันย้ายเข้า"><input type="number" value={f.elec_start} onChange={set('elec_start')} /></Field>
        <Field label="มิเตอร์น้ำเริ่มต้น"><input type="number" value={f.water_start} onChange={set('water_start')} /></Field>
      </div>
      <Field label="หมายเหตุ"><input value={f.note} onChange={set('note')} /></Field>
    </Modal>
  )
}

function TenantModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const bills = useFetch<Bill[]>(`/bills?tenant_id=${tenant.id}`)
  const [f, setF] = useState({ name: tenant.name, phone: tenant.phone ?? '', line_id: tenant.line_id ?? '', deposit: tenant.deposit, note: tenant.note ?? '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function save() {
    try {
      await api.put(`/tenants/${tenant.id}`, f)
      toast('บันทึกข้อมูลแล้ว')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') }
  }
  async function moveOut() {
    const msg = tenant.outstanding > 0
      ? `ผู้เช่ายังค้างชำระ ${baht(tenant.outstanding)} ยืนยันย้ายออก?`
      : `ยืนยันให้ ${tenant.name} ย้ายออกจากห้อง ${tenant.room_number}?`
    if (!confirm(msg)) return
    try {
      await api.post(`/tenants/${tenant.id}/move-out`, {})
      toast('บันทึกการย้ายออกแล้ว ห้องกลับเป็นว่าง')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <Modal wide title={`${tenant.name} · ห้อง ${tenant.room_number ?? '-'}`} onClose={onClose}
      footer={<>
        {!!tenant.active && <button className="btn btn-danger-ghost mr-auto" onClick={moveOut}><Icon name="door" size={16} />ย้ายออก</button>}
        <button className="btn btn-ghost" onClick={onClose}>ปิด</button>
        <button className="btn btn-primary" onClick={save}>บันทึก</button>
      </>}>
      <div className="grid-2">
        <Field label="ชื่อ-นามสกุล"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="เบอร์โทร"><input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="LINE ID"><input value={f.line_id} onChange={set('line_id')} /></Field>
        <Field label="เงินประกัน"><input type="number" value={f.deposit} onChange={set('deposit')} /></Field>
      </div>
      <Field label="หมายเหตุ"><input value={f.note} onChange={set('note')} /></Field>
      <h4 className="sub-title">ประวัติบิล</h4>
      {!bills.data ? <Loading /> : bills.data.length === 0 ? <Empty>ยังไม่มีบิล</Empty> : (
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th>เดือน</th><th className="num">ยอด</th><th>สถานะ</th></tr></thead>
            <tbody>{bills.data.map((b) => (
              <tr key={b.id}><td>{monthLabel(b.month, true)}</td><td className="num">{baht(b.total)}</td>
                <td>{b.status === 'paid' ? <Badge tone="green">ชำระแล้ว {dateLabel(b.paid_at)}</Badge> : <Badge tone="red">ค้างชำระ</Badge>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
