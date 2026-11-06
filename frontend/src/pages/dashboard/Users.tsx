import { motion } from 'motion/react'
import { useState } from 'react'
import { api, type UserRow } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateLabel } from '../../lib/format'
import { Badge, Empty, Field, Icon, Loading, Modal, useFetch, useToast } from '../../lib/ui'

export default function Users() {
  const { user: me } = useAuth()
  const { data, loading, reload } = useFetch<UserRow[]>('/users')
  const [editing, setEditing] = useState<Partial<UserRow> | null>(null)
  if (!data) return loading ? <Loading /> : <Empty>โหลดข้อมูลไม่สำเร็จ</Empty>
  return (
    <div className="stack">
      <div className="page-head">
        <p className="muted">เจ้าของหอเข้าถึงได้ทุกเมนู · พนักงานใช้งานได้ทุกอย่างยกเว้นตั้งค่าและจัดการผู้ใช้</p>
        <button className="btn btn-primary" onClick={() => setEditing({ role: 'staff', active: 1 })}><Icon name="plus" />เพิ่มผู้ใช้</button>
      </div>
      <div className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าระบบล่าสุด</th><th /></tr></thead>
            <tbody>
              {data.map((u, i) => (
                <motion.tr key={u.id} className="clickable" onClick={() => setEditing(u)}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <td><b>{u.name}</b>{u.id === me?.id && <small className="muted"> (คุณ)</small>}</td>
                  <td>@{u.username}</td>
                  <td>{u.role === 'owner' ? <Badge tone="blue">เจ้าของหอ</Badge> : <Badge tone="gray">พนักงาน</Badge>}</td>
                  <td>{u.active ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="red">ปิดใช้งาน</Badge>}</td>
                  <td>{u.last_login_at ? dateLabel(u.last_login_at) : <span className="muted">ยังไม่เคย</span>}</td>
                  <td className="num"><Icon name="chevR" size={16} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <UserModal u={editing} isMe={editing.id === me?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function UserModal({ u, isMe, onClose, onSaved }: { u: Partial<UserRow>; isMe: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: u.name ?? '', username: u.username ?? '', role: u.role ?? 'staff', active: u.active !== 0, password: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })
  async function save() {
    try {
      if (u.id) await api.put(`/users/${u.id}`, { ...f, password: f.password || undefined })
      else await api.post('/users', f)
      toast(u.id ? 'บันทึกผู้ใช้แล้ว' : 'เพิ่มผู้ใช้แล้ว')
      onSaved()
    } catch (e) { toast((e as Error).message, 'err') }
  }
  async function remove() {
    if (!confirm(`ลบผู้ใช้ @${u.username}?`)) return
    try { await api.del(`/users/${u.id}`); toast('ลบผู้ใช้แล้ว'); onSaved() } catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <Modal title={u.id ? `แก้ไข @${u.username}` : 'เพิ่มผู้ใช้'} onClose={onClose}
      footer={<>
        {u.id && !isMe && <button className="btn btn-danger-ghost mr-auto" onClick={remove}><Icon name="trash" size={16} />ลบ</button>}
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={save}>บันทึก</button>
      </>}>
      <div className="grid-2">
        <Field label="ชื่อที่แสดง"><input value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="ชื่อผู้ใช้"><input value={f.username} onChange={set('username')} disabled={!!u.id} autoCapitalize="none" /></Field>
        <Field label="สิทธิ์">
          <select value={f.role} onChange={set('role')}><option value="staff">พนักงาน</option><option value="owner">เจ้าของหอ</option></select>
        </Field>
        <Field label={u.id ? 'ตั้งรหัสผ่านใหม่' : 'รหัสผ่าน'} hint={u.id ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'อย่างน้อย 8 ตัวอักษร'}>
          <input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
        </Field>
      </div>
      {u.id && !isMe && <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} />เปิดใช้งานบัญชี</label>}
    </Modal>
  )
}
