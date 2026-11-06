import { motion } from 'motion/react'
import { useState } from 'react'
import { api, type Dashboard } from '../../lib/api'
import { baht, currentMonth, monthLabel, nf, relTime } from '../../lib/format'
import { Badge, Empty, Icon, Loading, useFetch, useToast } from '../../lib/ui'
import { MonthPicker, PRIORITY } from './shared'

export default function Overview() {
  const [month, setMonth] = useState(currentMonth())
  const { data, loading, reload } = useFetch<Dashboard>(`/dashboard?month=${month}`)
  const toast = useToast()
  if (!data) return loading ? <Loading /> : <Empty>โหลดข้อมูลไม่สำเร็จ</Empty>

  const occ = data.rooms.total ? Math.round((data.rooms.occupied / data.rooms.total) * 100) : 0
  const s = data.month_summary
  const collectPct = s.billed ? Math.round((s.collected / s.billed) * 100) : 0

  async function pay(id: number) {
    try {
      await api.post(`/bills/${id}/pay`, { method: 'transfer' })
      toast('บันทึกการชำระแล้ว')
      reload()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <MonthPicker value={month} onChange={setMonth} />
        <div className="row gap-sm">
          <a className="btn btn-ghost" href="#/app/meter"><Icon name="gauge" />จดมิเตอร์</a>
          <a className="btn btn-primary" href="#/app/tenants"><Icon name="plus" />เพิ่มผู้เช่า</a>
        </div>
      </div>

      {(data.meter_pending > 0 || data.new_inquiries > 0) && (
        <div className="alerts">
          {data.meter_pending > 0 && (
            <a href="#/app/meter" className="alert alert-amber">
              <Icon name="gauge" />ยังไม่ได้จดมิเตอร์/ออกบิลเดือน {monthLabel(month, true)} อีก <b>{data.meter_pending}</b> ห้อง<Icon name="chevR" />
            </a>
          )}
          {data.new_inquiries > 0 && (
            <a href="#/app/inquiries" className="alert alert-blue">
              <Icon name="inbox" />มีผู้สนใจเช่าใหม่ <b>{data.new_inquiries}</b> รายการ รอติดต่อกลับ<Icon name="chevR" />
            </a>
          )}
        </div>
      )}

      <motion.div className="kpis" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
        <Kpi label="อัตราการเข้าพัก" value={`${occ}%`} sub={`${data.rooms.occupied}/${data.rooms.total} ห้อง · ว่าง ${data.rooms.vacant} · ซ่อม ${data.rooms.maintenance}`}>
          <div className="meter-bar"><span style={{ width: `${occ}%` }} /></div>
        </Kpi>
        <Kpi label={`ยอดบิล ${monthLabel(month)}`} value={baht(s.billed)} sub={`${s.bills} บิล`} />
        <Kpi label="เก็บได้แล้ว" value={baht(s.collected)} sub={`${collectPct}% ของยอดบิล · ค้าง ${s.unpaid_count} บิล`}>
          <div className="meter-bar meter-green"><span style={{ width: `${collectPct}%` }} /></div>
        </Kpi>
        <Kpi label="ยอดค้างชำระทั้งหมด" value={baht(data.outstanding.amount)} sub={`${data.outstanding.count} บิล`} tone={data.outstanding.count ? 'red' : undefined} />
      </motion.div>

      <div className="grid-main">
        <section className="card">
          <header className="card-head"><h2>รายรับ 6 เดือนล่าสุด</h2>
            <div className="legend"><span className="lg lg-billed" />ยอดบิล <span className="lg lg-collected" />เก็บได้</div>
          </header>
          <TrendChart trend={data.trend} />
        </section>

        <section className="card">
          <header className="card-head"><h2>ค้างชำระ</h2><a href="#/app/bills" className="link">ดูทั้งหมด</a></header>
          {data.overdue.length ? (
            <ul className="list">
              {data.overdue.map((b) => (
                <li key={b.id} className="list-row">
                  <span className="room-chip">{b.room_number}</span>
                  <div className="grow"><b>{b.tenant_name ?? '-'}</b><small>{monthLabel(b.month)} · {baht(b.total)}</small></div>
                  <button className="btn btn-sm btn-ghost" onClick={() => pay(b.id)}><Icon name="check" size={16} />รับชำระ</button>
                </li>
              ))}
            </ul>
          ) : <Empty>ไม่มียอดค้างชำระ 🎉</Empty>}
        </section>
      </div>

      <div className="grid-main">
        <section className="card">
          <header className="card-head"><h2>การใช้น้ำ-ไฟ</h2></header>
          <div className="usage">
            {data.trend.map((t) => (
              <div key={t.month} className="usage-col">
                <span className="usage-m">{monthLabel(t.month)}</span>
                <span><Icon name="bolt" size={14} />{nf(t.elec_units)}</span>
                <span><Icon name="drop" size={14} />{nf(t.water_units)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <header className="card-head"><h2>งานซ่อมที่ค้าง</h2><a href="#/app/maintenance" className="link">ดูทั้งหมด</a></header>
          {data.tickets.length ? (
            <ul className="list">
              {data.tickets.map((t) => (
                <li key={t.id} className="list-row">
                  <span className="room-chip">{t.room_number ?? '—'}</span>
                  <div className="grow"><b>{t.title}</b><small>{relTime(t.created_at)}</small></div>
                  <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty>ไม่มีงานค้าง</Empty>}
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, children, tone }: { label: string; value: string; sub: string; children?: React.ReactNode; tone?: 'red' }) {
  return (
    <motion.div className={`kpi ${tone ? `kpi-${tone}` : ''}`}
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {children}
      <span className="kpi-sub">{sub}</span>
    </motion.div>
  )
}

function TrendChart({ trend }: { trend: Dashboard['trend'] }) {
  const max = Math.max(1, ...trend.map((t) => t.billed))
  const nice = Math.ceil(max / 25000) * 25000
  return (
    <div className="chart">
      <div className="chart-y">
        {[1, 0.5, 0].map((f) => <span key={f}>{f ? `${Math.round((nice * f) / 1000)}k` : '0'}</span>)}
      </div>
      <div className="chart-bars">
        {trend.map((t, i) => (
          <div key={t.month} className="chart-col" title={`${monthLabel(t.month, true)}\nยอดบิล ${baht(t.billed)}\nเก็บได้ ${baht(t.collected)}`}>
            <div className="chart-pair">
              <motion.span className="bar bar-billed" initial={{ height: 0 }} animate={{ height: `${(t.billed / nice) * 100}%` }} transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
              <motion.span className="bar bar-collected" initial={{ height: 0 }} animate={{ height: `${(t.collected / nice) * 100}%` }} transition={{ delay: 0.22 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            <span className="chart-x">{monthLabel(t.month)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
