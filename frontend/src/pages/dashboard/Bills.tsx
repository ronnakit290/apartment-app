import { useState } from 'react'
import { api, type Bill, type Settings } from '../../lib/api'
import { baht, currentMonth, dateLabel, monthLabel, nf } from '../../lib/format'
import { Badge, Empty, Field, Icon, Loading, Modal, useFetch, useToast } from '../../lib/ui'
import type { PageProps } from './Layout'
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
  const [invoice, setInvoice] = useState<Bill | null>(null)
  const toast = useToast()

  const total = (data ?? []).reduce((s, b) => s + b.total, 0)
  const paid = (data ?? []).filter((b) => b.status === 'paid').reduce((s, b) => s + b.total, 0)

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
        <div className="tabs">
          {([['', 'ทั้งหมด'], ['unpaid', 'ค้างชำระ'], ['paid', 'ชำระแล้ว']] as const).map(([k, l]) => (
            <button key={k} className={status === k ? 'active' : ''} onClick={() => setStatus(k)}>{l}</button>
          ))}
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
              <thead><tr><th>ห้อง</th><th>เดือน</th><th>ผู้เช่า</th><th className="num">ค่าเช่า</th><th className="num">ไฟ</th><th className="num">น้ำ</th><th className="num">รวม</th><th>สถานะ</th><th /></tr></thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.id}>
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
                      <button className="icon-btn" title="ใบแจ้งหนี้" onClick={() => setInvoice(b)}><Icon name="print" size={17} /></button>
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
      {invoice && settings && <InvoiceModal bill={invoice} settings={settings} onClose={() => setInvoice(null)} />}
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

function InvoiceModal({ bill, settings, onClose }: { bill: Bill; settings: Settings; onClose: () => void }) {
  const eu = bill.elec_curr - bill.elec_prev
  const wu = bill.water_curr - bill.water_prev
  const [y, m] = bill.month.split('-').map(Number)
  const due = new Date(y, m, settings.due_day)
  return (
    <Modal wide title="ใบแจ้งหนี้" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>ปิด</button><button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" />พิมพ์ / บันทึก PDF</button></>}>
      <div className="invoice" id="print-area">
        <header className="inv-head">
          <div><h2>{settings.name}</h2><p>{settings.address}</p><p>โทร {settings.phone}</p></div>
          <div className="inv-meta">
            <h3>{bill.status === 'paid' ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</h3>
            <p>เลขที่ INV-{bill.month.replace('-', '')}-{bill.room_number}</p>
            <p>ประจำเดือน {monthLabel(bill.month, true)}</p>
          </div>
        </header>
        <div className="inv-to"><span>ห้อง <b>{bill.room_number}</b></span><span>ผู้เช่า <b>{bill.tenant_name}</b></span></div>
        <table className="table inv-table">
          <thead><tr><th>รายการ</th><th className="num">ครั้งก่อน</th><th className="num">ครั้งนี้</th><th className="num">หน่วย</th><th className="num">ราคา/หน่วย</th><th className="num">จำนวนเงิน</th></tr></thead>
          <tbody>
            <tr><td>ค่าเช่าห้อง</td><td /><td /><td /><td /><td className="num">{nf(bill.rent)}</td></tr>
            <tr><td>ค่าไฟฟ้า</td><td className="num">{nf(bill.elec_prev)}</td><td className="num">{nf(bill.elec_curr)}</td><td className="num">{eu}</td><td className="num">{bill.elec_rate}</td><td className="num">{nf(eu * bill.elec_rate)}</td></tr>
            <tr><td>ค่าน้ำประปา</td><td className="num">{nf(bill.water_prev)}</td><td className="num">{nf(bill.water_curr)}</td><td className="num">{wu}</td><td className="num">{bill.water_rate}</td><td className="num">{nf(wu * bill.water_rate)}</td></tr>
            {bill.other !== 0 && <tr><td>{bill.other_note || 'ค่าใช้จ่ายอื่นๆ'}</td><td /><td /><td /><td /><td className="num">{nf(bill.other)}</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={5}>รวมทั้งสิ้น</td><td className="num">{baht(bill.total)}</td></tr></tfoot>
        </table>
        {bill.status === 'paid' ? (
          <p className="inv-paid">ชำระแล้ว ({METHOD[bill.method ?? ''] ?? '-'}) เมื่อ {dateLabel(bill.paid_at)}</p>
        ) : (
          <div className="inv-pay">
            <p>กรุณาชำระภายในวันที่ <b>{dateLabel(due.toISOString())}</b> · ล่าช้าปรับวันละ {settings.late_fee} บาท</p>
            {settings.bank_account && <p>โอนเข้าบัญชี {settings.bank_name} เลขที่ <b>{settings.bank_account}</b> ชื่อบัญชี {settings.bank_holder}</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}
