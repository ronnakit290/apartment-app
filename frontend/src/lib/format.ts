const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export const baht = (n: number) => `฿${Math.round(n).toLocaleString('th-TH')}`
export const nf = (n: number) => n.toLocaleString('th-TH')

export function monthLabel(ym: string, full = false) {
  const [y, m] = ym.split('-').map(Number)
  return `${(full ? TH_MONTHS_FULL : TH_MONTHS)[m - 1]} ${full ? y + 543 : String(y + 543).slice(2)}`
}

export function dateLabel(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso.includes('T') || iso.length <= 10 ? iso : iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`
}

export function relTime(iso: string) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'เมื่อสักครู่'
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`
  return `${Math.floor(diff / 86400)} วันที่แล้ว`
}

export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
