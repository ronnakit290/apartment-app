import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { api, type AuthUser } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Icon } from '../lib/ui'

export default function Login() {
  const { needsSetup, setUser } = useAuth()
  const [f, setF] = useState({ name: '', username: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (needsSetup && f.password !== f.confirm) return setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
    setBusy(true)
    try {
      const res = await api.post<{ user: AuthUser }>(needsSetup ? '/auth/setup' : '/auth/login', f)
      setUser(res.user)
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <motion.div className="login-art" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <motion.div className="login-art-inner" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <span className="brand"><span className="brand-mark">N</span>Nisia Residence</span>
          <h2>จัดการหอพักครบ<br />จบในที่เดียว</h2>
          <ul>
            {['จดมิเตอร์ ออกบิล ทั้งตึกในไม่กี่นาที', 'ติดตามยอดค้างชำระแบบเรียลไทม์', 'รับเรื่องแจ้งซ่อมและผู้สนใจเช่า'].map((t, i) => (
              <motion.li key={t} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.35 + i * 0.1 }}>
                <Icon name="check" size={16} />{t}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </motion.div>

      <div className="login-side">
        <motion.form className="login-card" onSubmit={submit}
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div>
            <h1>{needsSetup ? 'สร้างบัญชีเจ้าของหอ' : 'เข้าสู่ระบบ'}</h1>
            <p className="muted">{needsSetup ? 'ตั้งค่าครั้งแรก บัญชีนี้จะเป็นผู้ดูแลระบบหลัก' : 'สำหรับเจ้าของและพนักงานหอพัก'}</p>
          </div>
          {needsSetup && (
            <label className="field"><span className="field-label">ชื่อที่แสดง</span>
              <input value={f.name} onChange={set('name')} placeholder="เช่น คุณสมศักดิ์" autoComplete="name" /></label>
          )}
          <label className="field"><span className="field-label">ชื่อผู้ใช้</span>
            <input value={f.username} onChange={set('username')} autoFocus autoCapitalize="none" autoComplete="username" required /></label>
          <label className="field"><span className="field-label">รหัสผ่าน</span>
            <span className="pw-wrap">
              <input type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} required
                autoComplete={needsSetup ? 'new-password' : 'current-password'} minLength={needsSetup ? 8 : undefined} />
              <button type="button" className="pw-toggle" onClick={() => setShow(!show)}>{show ? 'ซ่อน' : 'แสดง'}</button>
            </span>
            {needsSetup && <span className="field-hint">อย่างน้อย 8 ตัวอักษร</span>}
          </label>
          {needsSetup && (
            <label className="field"><span className="field-label">ยืนยันรหัสผ่าน</span>
              <input type={show ? 'text' : 'password'} value={f.confirm} onChange={set('confirm')} required autoComplete="new-password" /></label>
          )}
          <AnimatePresence>
            {err && (
              <motion.p className="form-err login-err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -3, 3, 0] }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35 }}>{err}</motion.p>
            )}
          </AnimatePresence>
          <motion.button className="btn btn-primary btn-lg btn-block" disabled={busy} whileTap={{ scale: 0.98 }}>
            {busy ? 'กำลังดำเนินการ…' : needsSetup ? 'สร้างบัญชีและเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}
          </motion.button>
          <a href="#/" className="login-back">← กลับหน้าเว็บไซต์</a>
        </motion.form>
      </div>
    </div>
  )
}
