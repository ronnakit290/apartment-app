import { motion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Bill, Settings } from '../../lib/api'
import { baht, dateLabel, monthLabel, nf } from '../../lib/format'
import { Icon } from '../../lib/ui'
import { METHOD } from './shared'

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

/**
 * Full-screen print preview. Bills are laid out as A5 (landscape) halves,
 * two per A4 portrait sheet, with a dashed cut line between them.
 */
export function PrintBills({ bills, settings, onClose }: { bills: Bill[]; settings: Settings; onClose: () => void }) {
  const sheets = chunk(bills, 2)

  useEffect(() => {
    document.body.classList.add('printing')
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('printing')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <motion.div id="print-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="print-toolbar">
        <div>
          <b>พิมพ์บิล {bills.length} ใบ</b>
          <span className="muted"> · กระดาษ A4 {sheets.length} แผ่น (แผ่นละ 2 ห้อง ตัดครึ่งเป็น A5)</span>
        </div>
        <div className="row gap-sm">
          <button className="btn btn-ghost" onClick={onClose}>ปิด</button>
          <button className="btn btn-primary" onClick={() => window.print()} autoFocus><Icon name="print" />พิมพ์ / บันทึก PDF</button>
        </div>
      </div>
      <div className="print-pages">
        {sheets.map((pair, i) => (
          <section key={i} className="a4-sheet">
            <A5Bill bill={pair[0]} settings={settings} />
            <div className="cut-line"><span>✂ ตัดตามเส้น</span></div>
            {pair[1] ? <A5Bill bill={pair[1]} settings={settings} /> : <div className="a5-bill a5-empty" />}
          </section>
        ))}
      </div>
    </motion.div>,
    document.body,
  )
}

function A5Bill({ bill, settings }: { bill: Bill; settings: Settings }) {
  const eu = bill.elec_curr - bill.elec_prev
  const wu = bill.water_curr - bill.water_prev
  const [y, m] = bill.month.split('-').map(Number)
  const due = new Date(y, m, settings.due_day) // due_day of the following month
  const paid = bill.status === 'paid'

  return (
    <article className="a5-bill">
      <header className="a5-head">
        <div>
          <h2>{settings.name}</h2>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>โทร {settings.phone}{settings.line_id ? ` · LINE ${settings.line_id}` : ''}</p>}
        </div>
        <div className="a5-meta">
          <h3>{paid ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งค่าเช่า'}</h3>
          <p>เลขที่ INV-{bill.month.replace('-', '')}-{bill.room_number}</p>
          <p>ประจำเดือน {monthLabel(bill.month, true)}</p>
        </div>
      </header>

      <div className="a5-to">
        <div><span>ห้อง</span><b className="a5-room">{bill.room_number}</b></div>
        <div><span>ผู้เช่า</span><b>{bill.tenant_name ?? '-'}</b></div>
        <div><span>วันที่ออกบิล</span><b>{dateLabel(bill.created_at)}</b></div>
      </div>

      <table className="a5-table">
        <thead>
          <tr><th>รายการ</th><th>ครั้งก่อน</th><th>ครั้งนี้</th><th>หน่วย</th><th>ราคา/หน่วย</th><th>จำนวนเงิน</th></tr>
        </thead>
        <tbody>
          <tr><td>ค่าเช่าห้อง</td><td /><td /><td /><td /><td>{nf(bill.rent)}</td></tr>
          <tr><td>ค่าไฟฟ้า</td><td>{nf(bill.elec_prev)}</td><td>{nf(bill.elec_curr)}</td><td>{nf(eu)}</td><td>{bill.elec_rate}</td><td>{nf(eu * bill.elec_rate)}</td></tr>
          <tr><td>ค่าน้ำประปา</td><td>{nf(bill.water_prev)}</td><td>{nf(bill.water_curr)}</td><td>{nf(wu)}</td><td>{bill.water_rate}</td><td>{nf(wu * bill.water_rate)}</td></tr>
          {bill.other !== 0 && <tr><td colSpan={5}>{bill.other_note || 'ค่าใช้จ่ายอื่นๆ'}</td><td>{nf(bill.other)}</td></tr>}
        </tbody>
        <tfoot>
          <tr><td colSpan={5}>รวมทั้งสิ้น</td><td>{baht(bill.total)}</td></tr>
        </tfoot>
      </table>

      <footer className="a5-foot">
        {paid ? (
          <div className="a5-pay a5-paid">
            <b>ชำระแล้ว</b> {METHOD[bill.method ?? ''] ?? ''} เมื่อ {dateLabel(bill.paid_at)}
          </div>
        ) : (
          <div className="a5-pay">
            <p>กรุณาชำระภายในวันที่ <b>{dateLabel(due.toISOString())}</b> · ชำระล่าช้าปรับวันละ {nf(settings.late_fee)} บาท</p>
            {settings.bank_account && (
              <p>โอนเข้าบัญชี {settings.bank_name} เลขที่ <b>{settings.bank_account}</b> ชื่อบัญชี {settings.bank_holder}</p>
            )}
          </div>
        )}
        <div className="a5-sign">
          <span />
          <small>ผู้รับเงิน</small>
        </div>
      </footer>
    </article>
  )
}
