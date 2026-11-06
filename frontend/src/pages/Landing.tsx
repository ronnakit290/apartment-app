import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type FormEvent } from 'react'
import { api, type PublicInfo } from '../lib/api'
import { baht } from '../lib/format'
import { Icon, Loading, Reveal, useFetch } from '../lib/ui'

const ease = [0.22, 1, 0.36, 1] as const
const heroItem = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }

const AMENITIES = [
  { icon: 'train', title: 'ใกล้รถไฟฟ้า', text: 'เดิน 5 นาทีถึงสถานี BTS' },
  { icon: 'wifi', title: 'Wi-Fi ไฟเบอร์', text: 'ความเร็วสูง ฟรีทุกห้อง' },
  { icon: 'shield', title: 'ปลอดภัย 24 ชม.', text: 'คีย์การ์ด กล้องวงจรปิด รปภ.' },
  { icon: 'car', title: 'ที่จอดรถ', text: 'จอดรถยนต์และมอเตอร์ไซค์' },
  { icon: 'washer', title: 'ห้องซักรีด', text: 'เครื่องซักผ้าหยอดเหรียญ' },
  { icon: 'wrench', title: 'แจ้งซ่อมไว', text: 'ทีมช่างดูแลภายใน 24 ชม.' },
]

const TYPE_DETAIL: Record<string, string[]> = {
  'สตูดิโอ': ['เตียง 5 ฟุต', 'แอร์ + เครื่องทำน้ำอุ่น', 'ตู้เสื้อผ้า โต๊ะทำงาน'],
  'ดีลักซ์': ['เตียง 6 ฟุต + โซฟา', 'ระเบียงกว้าง', 'ตู้เย็น ไมโครเวฟ'],
  'สวีท': ['ห้องนอนแยก', 'ครัวเล็ก + เคาน์เตอร์', 'วิวเมือง ชั้นบนสุด'],
}

export default function Landing() {
  const { data, loading } = useFetch<PublicInfo>('/public')
  const [menu, setMenu] = useState(false)

  if (loading && !data) return <div className="landing"><Loading /></div>
  if (!data) return <div className="landing"><p className="empty">ไม่สามารถโหลดข้อมูลได้ กรุณาเปิดเซิร์ฟเวอร์ backend</p></div>
  const vacant = data.vacant_rooms.length

  return (
    <div className="landing">
      <nav className="lnav">
        <div className="lnav-inner">
          <a href="#/" className="brand"><span className="brand-mark">N</span>{data.name}</a>
          <button className="icon-btn lnav-toggle" onClick={() => setMenu(!menu)} aria-label="เมนู"><Icon name="menu" /></button>
          <div className={`lnav-links ${menu ? 'open' : ''}`} onClick={() => setMenu(false)}>
            <a href="#rooms" onClick={(e) => scrollTo(e, 'rooms')}>ห้องพัก</a>
            <a href="#amenities" onClick={(e) => scrollTo(e, 'amenities')}>สิ่งอำนวยความสะดวก</a>
            <a href="#pricing" onClick={(e) => scrollTo(e, 'pricing')}>ค่าใช้จ่าย</a>
            <a href="#contact" onClick={(e) => scrollTo(e, 'contact')}>ติดต่อ</a>
            <a href="#/app" className="btn btn-ghost btn-sm">สำหรับเจ้าของหอ</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <motion.div className="hero-copy" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.09 } } }}>
          <motion.span variants={heroItem} className="eyebrow"><span className="dot" />ว่าง {vacant} ห้อง พร้อมเข้าอยู่</motion.span>
          <motion.h1 variants={heroItem}>บ้านหลังที่สอง<br />ที่<em>ใช่</em>สำหรับคุณ</motion.h1>
          <motion.p variants={heroItem} className="lead">{data.tagline}</motion.p>
          <motion.div variants={heroItem} className="hero-cta">
            <a href="#contact" className="btn btn-accent btn-lg" onClick={(e) => scrollTo(e, 'contact')}>นัดดูห้อง <Icon name="arrowR" /></a>
            <a href="#rooms" className="btn btn-ghost btn-lg" onClick={(e) => scrollTo(e, 'rooms')}>ดูห้องว่าง</a>
          </motion.div>
          <motion.dl variants={heroItem} className="hero-stats">
            <div><dt>เริ่มต้น</dt><dd>{baht(data.types[0]?.min_rent ?? 0)}<small>/เดือน</small></dd></div>
            <div><dt>ทั้งหมด</dt><dd>{data.total_rooms}<small> ห้อง</small></dd></div>
            <div><dt>ค่าไฟ</dt><dd>{data.elec_rate}<small> บาท/หน่วย</small></dd></div>
          </motion.dl>
        </motion.div>
        <Building rooms={data.building} />
      </header>

      <section id="rooms" className="lsection">
        <Reveal className="lsection-head">
          <span className="eyebrow-plain">ประเภทห้อง</span>
          <h2>เลือกขนาดที่เข้ากับไลฟ์สไตล์</h2>
        </Reveal>
        <div className="type-grid">
          {data.types.map((t, i) => (
            <Reveal key={t.type} delay={i * 0.08} className="type-card" whileHover={{ y: -6, transition: { duration: 0.2 } }}>
              <div className="type-top">
                <h3>{t.type}</h3>
                <span className={`pill ${t.vacant ? 'pill-ok' : 'pill-full'}`}>{t.vacant ? `ว่าง ${t.vacant} ห้อง` : 'เต็ม'}</span>
              </div>
              <p className="type-size">{t.size} ตร.ม.</p>
              <p className="type-price">{baht(t.min_rent)}<small> /เดือน</small></p>
              <ul className="ticks-list">
                {(TYPE_DETAIL[t.type] ?? ['เฟอร์นิเจอร์ครบ']).map((d) => <li key={d}><Icon name="check" size={16} />{d}</li>)}
              </ul>
            </Reveal>
          ))}
        </div>
        {vacant > 0 && (
          <Reveal className="vacant-strip">
            <h3>ห้องว่างตอนนี้</h3>
            <div className="vacant-list">
              {data.vacant_rooms.map((r) => (
                <div key={r.number} className="vacant-item">
                  <strong>{r.number}</strong>
                  <span>ชั้น {r.floor} · {r.type} · {r.size} ตร.ม.</span>
                  <span className="vacant-rent">{baht(r.rent)}</span>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </section>

      <section id="amenities" className="lsection lsection-tint">
        <Reveal className="lsection-head">
          <span className="eyebrow-plain">สิ่งอำนวยความสะดวก</span>
          <h2>ครบในที่เดียว ใช้ชีวิตง่ายขึ้น</h2>
        </Reveal>
        <div className="amen-grid">
          {AMENITIES.map((a, i) => (
            <Reveal key={a.title} delay={(i % 3) * 0.08} className="amen">
              <span className="amen-icon"><Icon name={a.icon} size={22} /></span>
              <div><h4>{a.title}</h4><p>{a.text}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="pricing" className="lsection">
        <Reveal className="pricing">
          <div>
            <span className="eyebrow-plain">ค่าใช้จ่ายโปร่งใส</span>
            <h2>รู้ล่วงหน้า ไม่มีค่าแอบแฝง</h2>
            <p className="muted">บิลรายเดือนคำนวณจากมิเตอร์จริงทุกห้อง แจ้งยอดผ่านระบบ ชำระง่ายด้วยการโอนหรือเงินสด</p>
          </div>
          <div className="price-table">
            <div><span>ค่าเช่าห้อง</span><strong>{baht(data.types[0]?.min_rent ?? 0)} – {baht(Math.max(...data.types.map((t) => t.min_rent)))}</strong></div>
            <div><span><Icon name="bolt" size={16} /> ค่าไฟฟ้า</span><strong>{data.elec_rate} บาท / หน่วย</strong></div>
            <div><span><Icon name="drop" size={16} /> ค่าน้ำประปา</span><strong>{data.water_rate} บาท / หน่วย</strong></div>
            <div><span>เงินประกัน</span><strong>2 เดือน</strong></div>
            <div><span>สัญญาขั้นต่ำ</span><strong>6 เดือน</strong></div>
          </div>
        </Reveal>
      </section>

      <section id="contact" className="lsection lsection-tint">
        <Reveal className="contact">
          <div className="contact-info">
            <span className="eyebrow-plain">ติดต่อเรา</span>
            <h2>นัดดูห้องได้ทุกวัน</h2>
            <p className="muted">ฝากข้อมูลไว้ เจ้าหน้าที่จะติดต่อกลับภายใน 24 ชั่วโมง</p>
            <ul className="contact-list">
              {data.phone && <li><Icon name="phone" /><a href={`tel:${data.phone}`}>{data.phone}</a></li>}
              {data.line_id && <li><span className="line-tag">LINE</span>{data.line_id}</li>}
              {data.address && <li><Icon name="pin" />{data.address}</li>}
            </ul>
          </div>
          <InquiryForm types={data.types.map((t) => t.type)} />
        </Reveal>
      </section>

      <footer className="lfooter">
        <span>© {new Date().getFullYear()} {data.name}</span>
        <a href="#/app">เข้าสู่ระบบจัดการหอพัก →</a>
      </footer>
    </div>
  )
}

function scrollTo(e: React.MouseEvent, id: string) {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function Building({ rooms }: { rooms: PublicInfo['building'] }) {
  const floors = useMemo(() => {
    const m = new Map<number, PublicInfo['building']>()
    rooms.forEach((r) => m.set(r.floor, [...(m.get(r.floor) ?? []), r]))
    return [...m.entries()].sort((a, b) => b[0] - a[0])
  }, [rooms])
  return (
    <motion.div className="building" aria-label="ผังห้องว่างของอาคาร" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease }}>
      <div className="building-roof">{rooms.length ? 'NISIA' : ''}</div>
      {floors.map(([f, rs], fi) => (
        <div key={f} className="building-floor">
          <span className="floor-no">{f}F</span>
          {rs.map((r, i) => (
            <motion.span key={r.number} className={`win ${r.vacant ? 'win-vacant' : ''}`} title={`${r.number}${r.vacant ? ' (ว่าง)' : ''}`}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + (floors.length - fi) * 0.12 + i * 0.03, type: 'spring', stiffness: 400, damping: 22 }}>
              {r.vacant && <i>{r.number}</i>}
            </motion.span>
          ))}
        </div>
      ))}
      <div className="building-base"><span className="door" /></div>
      <div className="building-legend"><span className="win win-vacant mini" /> ห้องว่าง <span className="win mini" /> มีผู้เช่า</div>
    </motion.div>
  )
}

function InquiryForm({ types }: { types: string[] }) {
  const [f, setF] = useState({ name: '', phone: '', room_type: types[0] ?? '', move_in: '', message: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setState('sending')
    try {
      await api.post('/public/inquiries', f)
      setState('done')
    } catch (x) {
      setErr((x as Error).message)
      setState('idle')
    }
  }

  if (state === 'done')
    return (
      <motion.div className="inq-form inq-done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
        <motion.span className="done-icon" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15, type: 'spring', stiffness: 380, damping: 16 }}><Icon name="check" size={28} /></motion.span>
        <h3>ได้รับข้อมูลแล้ว ขอบคุณค่ะ</h3>
        <p className="muted">เจ้าหน้าที่จะโทรกลับที่เบอร์ {f.phone} โดยเร็วที่สุด</p>
        <button className="btn btn-ghost" onClick={() => { setF({ ...f, name: '', phone: '', message: '' }); setState('idle') }}>ส่งอีกครั้ง</button>
      </motion.div>
    )

  return (
    <form className="inq-form" onSubmit={submit}>
      <div className="grid-2">
        <label className="field"><span className="field-label">ชื่อ-นามสกุล *</span><input required value={f.name} onChange={set('name')} /></label>
        <label className="field"><span className="field-label">เบอร์โทร *</span><input required type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="08x-xxx-xxxx" /></label>
        <label className="field"><span className="field-label">ประเภทห้อง</span>
          <select value={f.room_type} onChange={set('room_type')}>{types.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="field"><span className="field-label">วันที่ต้องการเข้าอยู่</span><input type="date" value={f.move_in} onChange={set('move_in')} /></label>
      </div>
      <label className="field"><span className="field-label">ข้อความเพิ่มเติม</span><textarea rows={3} value={f.message} onChange={set('message')} placeholder="เช่น ต้องการนัดดูห้องวันเสาร์" /></label>
      <AnimatePresence>{err && <motion.p className="form-err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{err}</motion.p>}</AnimatePresence>
      <button className="btn btn-accent btn-lg btn-block" disabled={state === 'sending'}>{state === 'sending' ? 'กำลังส่ง…' : 'ส่งข้อมูลนัดดูห้อง'}</button>
    </form>
  )
}
