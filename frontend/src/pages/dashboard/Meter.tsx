import { useEffect, useState } from 'react'
import { api, type MeterRow } from '../../lib/api'
import { baht, currentMonth, nf } from '../../lib/format'
import { Badge, Empty, Icon, Loading, go, useFetch, useToast } from '../../lib/ui'
import type { PageProps } from './Layout'
import { MonthPicker } from './shared'

type Input = { elec_curr: string; water_curr: string; other: string; other_note: string }

export default function Meter({ settings }: PageProps) {
  const [month, setMonth] = useState(currentMonth())
  const { data, loading, reload } = useFetch<MeterRow[]>(`/meter?month=${month}`)
  const [inputs, setInputs] = useState<Record<number, Input>>({})
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const er = settings?.elec_rate ?? 7
  const wr = settings?.water_rate ?? 18

  useEffect(() => {
    if (!data) return
    const init: Record<number, Input> = {}
    data.forEach((r) => {
      init[r.room_id] = {
        elec_curr: r.bill ? String(r.bill.elec_curr) : '',
        water_curr: r.bill ? String(r.bill.water_curr) : '',
        other: r.bill?.other ? String(r.bill.other) : '',
        other_note: r.bill?.other_note ?? '',
      }
    })
    setInputs(init)
  }, [data])

  if (!data) return loading ? <Loading /> : <Empty>โหลดข้อมูลไม่สำเร็จ</Empty>

  const calc = (r: MeterRow) => {
    const i = inputs[r.room_id]
    if (!i || i.elec_curr === '' || i.water_curr === '') return null
    const eu = Number(i.elec_curr) - r.elec_prev
    const wu = Number(i.water_curr) - r.water_prev
    if (eu < 0 || wu < 0) return { eu, wu, total: NaN }
    return { eu, wu, total: r.rent + eu * er + wu * wr + (Number(i.other) || 0) }
  }
  const set = (id: number, k: keyof Input, v: string) => setInputs((x) => ({ ...x, [id]: { ...x[id], [k]: v } }))
  const editable = data.filter((r) => r.bill?.status !== 'paid')
  const filled = editable.filter((r) => calc(r))
  const done = data.filter((r) => r.bill).length

  async function save() {
    const items = filled.map((r) => ({ room_id: r.room_id, ...inputs[r.room_id] }))
    if (!items.length) return toast('กรอกเลขมิเตอร์อย่างน้อย 1 ห้อง', 'err')
    setBusy(true)
    try {
      const res = await api.post<{ created: number; updated: number; errors: string[] }>('/bills/batch', { month, items })
      toast(`ออกบิลใหม่ ${res.created} · อัปเดต ${res.updated} ห้อง`)
      res.errors.forEach((e) => toast(e, 'err'))
      reload()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <MonthPicker value={month} onChange={setMonth} />
        <div className="row gap-sm">
          <span className="muted">ออกบิลแล้ว {done}/{data.length} ห้อง · ไฟ {er} ฿/หน่วย · น้ำ {wr} ฿/หน่วย</span>
          <button className="btn btn-ghost" onClick={() => go('/app/bills')}><Icon name="receipt" />ดูบิล</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !filled.length}><Icon name="check" />บันทึก & ออกบิล ({filled.length})</button>
        </div>
      </div>

      <div className="card card-flush">
        {data.length === 0 ? <Empty>ยังไม่มีห้องที่มีผู้เช่า</Empty> : (
          <div className="table-wrap">
            <table className="table meter-table">
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th className="num"><Icon name="bolt" size={14} /> ไฟครั้งก่อน</th><th>ไฟครั้งนี้</th>
                  <th className="num"><Icon name="drop" size={14} /> น้ำครั้งก่อน</th><th>น้ำครั้งนี้</th>
                  <th>ค่าอื่นๆ</th><th className="num">ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const c = calc(r)
                  const locked = r.bill?.status === 'paid'
                  const i = inputs[r.room_id] ?? { elec_curr: '', water_curr: '', other: '', other_note: '' }
                  return (
                    <tr key={r.room_id} className={locked ? 'row-locked' : ''}>
                      <td><span className="room-chip">{r.number}</span><small className="block muted">{r.tenant_name}</small></td>
                      <td className="num muted">{nf(r.elec_prev)}</td>
                      <td>
                        <input className="meter-in" type="number" inputMode="numeric" disabled={locked} value={i.elec_curr}
                          onChange={(e) => set(r.room_id, 'elec_curr', e.target.value)} placeholder={String(r.elec_prev)} />
                        {c && <small className={`block ${c.eu < 0 ? 'text-red' : 'muted'}`}>{c.eu} หน่วย</small>}
                      </td>
                      <td className="num muted">{nf(r.water_prev)}</td>
                      <td>
                        <input className="meter-in" type="number" inputMode="numeric" disabled={locked} value={i.water_curr}
                          onChange={(e) => set(r.room_id, 'water_curr', e.target.value)} placeholder={String(r.water_prev)} />
                        {c && <small className={`block ${c.wu < 0 ? 'text-red' : 'muted'}`}>{c.wu} หน่วย</small>}
                      </td>
                      <td>
                        <input className="meter-in meter-other" type="number" disabled={locked} value={i.other} placeholder="0"
                          onChange={(e) => set(r.room_id, 'other', e.target.value)} />
                        <input className="meter-in meter-note" disabled={locked} value={i.other_note} placeholder="รายละเอียด"
                          onChange={(e) => set(r.room_id, 'other_note', e.target.value)} />
                      </td>
                      <td className="num">
                        {locked ? <Badge tone="green">ชำระแล้ว</Badge>
                          : c ? (Number.isNaN(c.total) ? <span className="text-red">เลขน้อยกว่าเดิม</span> : <b>{baht(c.total)}</b>)
                          : r.bill ? <span className="muted">{baht(r.bill.total)}</span> : <span className="muted">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
