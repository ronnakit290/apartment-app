import { monthLabel, shiftMonth } from '../../lib/format'
import { Icon } from '../../lib/ui'

export const PRIORITY = {
  high: { label: 'ด่วน', tone: 'red' },
  normal: { label: 'ปกติ', tone: 'amber' },
  low: { label: 'ไม่ด่วน', tone: 'gray' },
} as const

export const ROOM_STATUS = {
  occupied: { label: 'มีผู้เช่า', tone: 'blue' },
  vacant: { label: 'ว่าง', tone: 'orange' },
  maintenance: { label: 'ปิดซ่อม', tone: 'amber' },
} as const

export const METHOD: Record<string, string> = { transfer: 'โอนเงิน', cash: 'เงินสด', qr: 'QR PromptPay' }

export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div className="month-picker">
      <button className="icon-btn" onClick={() => onChange(shiftMonth(value, -1))} aria-label="เดือนก่อน"><Icon name="chevL" /></button>
      <span>{monthLabel(value, true)}</span>
      <button className="icon-btn" onClick={() => onChange(shiftMonth(value, 1))} aria-label="เดือนถัดไป"><Icon name="chevR" /></button>
    </div>
  )
}
