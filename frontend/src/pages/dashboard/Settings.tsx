import { useState } from 'react'
import { api, type Settings } from '../../lib/api'
import { Field, Loading, useToast } from '../../lib/ui'
import type { PageProps } from './Layout'

export default function SettingsPage({ settings }: PageProps) {
  if (!settings) return <Loading />
  return <Form initial={settings} />
}

function Form({ initial }: { initial: Settings }) {
  const toast = useToast()
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/settings', f)
      toast('บันทึกการตั้งค่าแล้ว')
      setTimeout(() => window.location.reload(), 400)
    } catch (x) { toast((x as Error).message, 'err') } finally { setBusy(false) }
  }
  return (
    <form className="stack settings" onSubmit={save}>
      <section className="card">
        <h2 className="card-title">ข้อมูลหอพัก</h2>
        <p className="muted">แสดงบนหน้าเว็บไซต์และใบแจ้งหนี้</p>
        <div className="grid-2">
          <Field label="ชื่อหอพัก"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="เบอร์โทร"><input value={f.phone ?? ''} onChange={set('phone')} /></Field>
          <Field label="LINE Official"><input value={f.line_id ?? ''} onChange={set('line_id')} /></Field>
          <Field label="สโลแกน"><input value={f.tagline ?? ''} onChange={set('tagline')} /></Field>
        </div>
        <Field label="ที่อยู่"><input value={f.address ?? ''} onChange={set('address')} /></Field>
      </section>
      <section className="card">
        <h2 className="card-title">อัตราค่าบริการ</h2>
        <p className="muted">ใช้คำนวณบิลที่ออกใหม่ บิลเก่าไม่เปลี่ยน</p>
        <div className="grid-4">
          <Field label="ค่าไฟ (บาท/หน่วย)"><input type="number" step="0.01" value={f.elec_rate} onChange={set('elec_rate')} /></Field>
          <Field label="ค่าน้ำ (บาท/หน่วย)"><input type="number" step="0.01" value={f.water_rate} onChange={set('water_rate')} /></Field>
          <Field label="ครบกำหนดชำระวันที่"><input type="number" min={1} max={28} value={f.due_day} onChange={set('due_day')} /></Field>
          <Field label="ค่าปรับล่าช้า (บาท/วัน)"><input type="number" value={f.late_fee} onChange={set('late_fee')} /></Field>
        </div>
      </section>
      <section className="card">
        <h2 className="card-title">บัญชีรับเงิน</h2>
        <div className="grid-3">
          <Field label="ธนาคาร"><input value={f.bank_name ?? ''} onChange={set('bank_name')} /></Field>
          <Field label="เลขบัญชี"><input value={f.bank_account ?? ''} onChange={set('bank_account')} /></Field>
          <Field label="ชื่อบัญชี"><input value={f.bank_holder ?? ''} onChange={set('bank_holder')} /></Field>
        </div>
      </section>
      <div className="row end"><button className="btn btn-primary btn-lg" disabled={busy}>บันทึกการตั้งค่า</button></div>
    </form>
  )
}
