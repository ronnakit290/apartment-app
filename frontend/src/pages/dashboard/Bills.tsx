import { useEffect, useMemo, useState } from 'react'
import { api, type Bill } from '../../lib/api'
import { baht, currentMonth, dateLabel, monthLabel, nf } from '../../lib/format'
import { Badge, Empty, Field, Icon, Loading, Modal, useFetch, useToast } from '../../lib/ui'
import type { PageProps } from './Layout'
import { PrintBills } from './BillPrint'
import { METHOD, MonthPicker } from './shared'

export default function Bills({ settings }: PageProps) {
  const [month, setMonth] = useState(currentMonth())
  const [status, setStatus] = useState<'' | 'paid' | 'unpaid'>('')
  const [allMonths, setAllMonths] = useState(false)
  const qs = new URLSearchParams()
  if (!allMonths) qs.set('month', month)
  if (status) qs.set('status', status)
  const { data, loading, reload } = useFetch<Bill[]>(`/bills?${qs}`)
  const [paying, setPaying] = useState<Bill | null>(null)
  const [printing, setPrinting] = useState<Bill[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  useEffect(() => setSelected(new Set()), [month, status, allMonths])
  const toast = useToast()

  const total = (data ?? []).reduce((s, b) => s + b.total, 0)
  const paid = (data ?? []).filter((b) => b.status === 'paid').reduce((s, b) => s + b.total, 0)
  const allChecked = !!data?.length && data.every((b) => selected.has(b.id))
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set((data ?? []).map((b) => b.id)))
  // print in room order so the stack of cut A5 bills comes out sorted
  const toPrint = useMemo(() => {
    const list = (data ?? []).filter((b) => !selected.size || selected.has(b.id))
    return [...list].sort((a, b) => a.month.localeCompare(b.month) || a.room_number.localeCompare(b.room_number, undefined, { numeric: true }))
  }, [data, selected])

  async function act(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); toast(msg); reload() } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row gap-sm">
          {!allMonths && <MonthPicker value={month} onChange={setMonth} />}
          <label className="check"><input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />ทุกเดือน</label>
        </div>
        <div className="row gap-sm wrap">
          <div className="tabs">
            {([['', 'ทั้งหมด'], ['unpaid', 'ค้างชำระ'], ['paid', 'ชำระแล้ว']] as const).map(([k, l]) => (
              <button key={k} className={status === k ? 'active' : ''} onClick={() => setStatus(k)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-primary" disabled={!toPrint.length || !settings} onClick={() => setPrinting(toPrint)}>
            <Icon name="print" />{selected.size ? `พิมพ์บิลที่เลือก (${toPrint.length})` : `พิมพ์บิลทั้งหมด (${toPrint.length})`}
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <div><span>ยอดรวม</span><b>{baht(total)}</b></div>
        <div><span>ชำระแล้ว</span><b className="text-green">{baht(paid)}</b></div>
        <div><span>ค้างชำระ</span><b className="text-red">{baht(total - paid)}</b></div>
        <div><span>จำนวนบิล</span><b>{data?.length ?? 0}</b></div>
      </div>

      <div className="card card-flush">
        {!data ? <Loading /> : data.length === 0 ? (
          <Empty>{loading ? 'กำลังโหลด…' : <>ไม่มีบิล — <a className="link" href="#/app/meter">ไปจดมิเตอร์เพื่อออกบิล</a></>}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th className="col-check"><input type="checkbox" aria-label="เลือกทั้งหมด" checked={allChecked} onChange={toggleAll} /></th><th>ห้อง</th><th>เดือน</th><th>ผู้เช่า</th><th className="num">ค่าเช่า</th><th className="num">ไฟ</th><th className="num">น้ำ</th><th className="num">รวม</th><th>สถานะ</th><th /></tr></thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.id} className={selected.has(b.id) ? 'row-selected' : ''}>
                    <td className="col-check"><input type="checkbox" aria-label={`เลือกห้อง ${b.room_number}`} checked={selected.has(b.id)} onChange={() => toggle(b.id)} /></td>
                    <td><span className="room-chip">{b.room_number}</span></td>
                    <td>{monthLabel(b.month)}</td>
                    <td>{b.tenant_name ?? '-'}</td>
                    <td className="num">{nf(b.rent)}</td>
                    <td className="num">{nf((b.elec_curr - b.elec_prev) * b.elec_rate)}</td>
                    <td className="num">{nf((b.water_curr - b.water_prev) * b.water_rate)}</td>
                    <td className="num"><b>{baht(b.total)}</b></td>
                    <td>{b.status === 'paid'
                      ? <Badge tone="green">{METHOD[b.method ?? ''] ?? 'ชำระแล้ว'} · {dateLabel(b.paid_at)}</Badge>
                      : <Badge tone="red">ค้างชำระ</Badge>}</td>
                    <td className="actions">
                      <button className="icon-btn" title="พิมพ์บิล A5" onClick={() => setPrinting([b])}><Icon name="print" size={17} /></button>
                      {b.status === 'unpaid' ? <>
                        <button className="btn btn-sm btn-primary" onClick={() => setPaying(b)}>รับชำระ</button>
                        <button className="icon-btn" title="ลบบิล" onClick={() => confirm(`ลบบิลห้อง ${b.room_number}?`) && act(() => api.del(`/bills/${b.id}`), 'ลบบิลแล้ว')}><Icon name="trash" size={16} /></button>
                      </> : <button className="btn btn-sm btn-ghost" onClick={() => confirm('ยกเลิกการชำระของบิลนี้?') && act(() => api.post(`/bills/${b.id}/unpay`), 'ยกเลิกการชำระแล้ว')}>ยกเลิก</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paying && <PayModal bill={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); reload() }} />}
      {printing && settings && <PrintBills bills={printing} settings={settings} onClose={() => setPrinting(null)} />}
    </div>
  )
}

function PayModal({ bill, onClose, onSaved }: { bill: Bill; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [method, setMethod] = useState('transfer')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  async function save() {
    try {
      await api.post(`/bills/${bill.id}/pay`, { method, paid_at: new Date(`${date}T12:00:00`).toISOString() })
      toast(`รับชำระห้อง ${bill.room_number} แล้ว`)
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <Modal title={`รับชำระ · ห้อง ${bill.room_number}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" onClick={save}>ยืนยันรับเงิน {baht(bill.total)}</button></>}>
      <p className="pay-amount">{baht(bill.total)}<small>{monthLabel(bill.month, true)} · {bill.tenant_name}</small></p>
      <div className="seg">
        {Object.entries(METHOD).map(([k, l]) => (
          <button key={k} className={method === k ? 'active' : ''} onClick={() => setMethod(k)}>{l}</button>
        ))}
      </div>
      <Field label="วันที่รับเงิน"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    </Modal>
  )
}
