import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, type Settings } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Field, Icon, Modal, useFetch, useToast } from '../../lib/ui'
import Overview from './Overview'
import Rooms from './Rooms'
import Tenants from './Tenants'
import Meter from './Meter'
import Bills from './Bills'
import Maintenance from './Maintenance'
import Inquiries from './Inquiries'
import SettingsPage from './Settings'
import Users from './Users'

const NAV = [
  { path: '/app', label: 'ภาพรวม', icon: 'home', el: Overview },
  { path: '/app/rooms', label: 'ห้องพัก', icon: 'grid', el: Rooms },
  { path: '/app/tenants', label: 'ผู้เช่า', icon: 'users', el: Tenants },
  { path: '/app/meter', label: 'จดมิเตอร์', icon: 'gauge', el: Meter },
  { path: '/app/bills', label: 'บิล & การชำระ', icon: 'receipt', el: Bills },
  { path: '/app/maintenance', label: 'แจ้งซ่อม', icon: 'wrench', el: Maintenance },
  { path: '/app/inquiries', label: 'ผู้สนใจเช่า', icon: 'inbox', el: Inquiries },
  { path: '/app/users', label: 'ผู้ใช้งาน', icon: 'shield', el: Users, owner: true },
  { path: '/app/settings', label: 'ตั้งค่า', icon: 'settings', el: SettingsPage, owner: true },
]

export default function DashboardLayout({ path }: { path: string }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const { data: settings } = useFetch<Settings>('/settings')
  const nav = NAV.filter((n) => !n.owner || user?.role === 'owner')
  const route = path.split('?')[0]
  const current = nav.find((n) => n.path === route) ?? nav[0]
  const Page = current.el

  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [route])
  useEffect(() => {
    document.title = `${current.label} · ${settings?.name ?? 'Dashboard'}`
  }, [current, settings])

  return (
    <div className="app">
      <aside className={`side ${open ? 'open' : ''}`}>
        <a href="#/app" className="brand side-brand"><span className="brand-mark">N</span><span>{settings?.name ?? '…'}</span></a>
        <nav className="side-nav">
          {nav.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={n.path === current.path ? 'active' : ''}>
              {n.path === current.path && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <Icon name={n.icon} /><span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-user">
          <span className="avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
          <div className="grow">
            <b>{user?.name}</b>
            <small>{user?.role === 'owner' ? 'เจ้าของหอ' : 'พนักงาน'} · @{user?.username}</small>
          </div>
        </div>
        <div className="side-actions">
          <button onClick={() => setPwOpen(true)}><Icon name="shield" size={16} />เปลี่ยนรหัสผ่าน</button>
          <button onClick={logout}><Icon name="logout" size={16} />ออกจากระบบ</button>
        </div>
        <a href="#/" className="side-foot"><Icon name="home" size={16} />ไปหน้าเว็บไซต์</a>
      </aside>
      <AnimatePresence>
        {open && <motion.div className="side-scrim" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn side-toggle" onClick={() => setOpen(true)} aria-label="เมนู"><Icon name="menu" /></button>
          <AnimatePresence mode="wait">
            <motion.h1 key={current.path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {current.label}
            </motion.h1>
          </AnimatePresence>
        </header>
        <AnimatePresence mode="wait">
          <motion.div key={current.path} className="content"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <Page settings={settings} />
          </motion.div>
        </AnimatePresence>
      </main>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  async function save() {
    if (f.next !== f.confirm) return toast('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', 'err')
    try {
      await api.put('/auth/password', f)
      toast('เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นจะถูกออกจากระบบ')
      onClose()
    } catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" onClick={save}>บันทึก</button></>}>
      <Field label="รหัสผ่านปัจจุบัน"><input type="password" autoComplete="current-password" value={f.current} onChange={set('current')} autoFocus /></Field>
      <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร"><input type="password" autoComplete="new-password" value={f.next} onChange={set('next')} /></Field>
      <Field label="ยืนยันรหัสผ่านใหม่"><input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
    </Modal>
  )
}

export type PageProps = { settings: Settings | null }
