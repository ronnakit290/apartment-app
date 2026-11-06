export type RoomStatus = 'occupied' | 'vacant' | 'maintenance'

export interface Settings {
  name: string
  tagline: string | null
  address: string | null
  phone: string | null
  line_id: string | null
  elec_rate: number
  water_rate: number
  due_day: number
  late_fee: number
  bank_name: string | null
  bank_account: string | null
  bank_holder: string | null
}

export interface Room {
  id: number
  number: string
  floor: number
  type: string
  size: number | null
  rent: number
  maintenance: number
  note: string | null
  status: RoomStatus
  tenant_id: number | null
  tenant_name: string | null
  tenant_phone: string | null
}

export interface Tenant {
  id: number
  name: string
  phone: string | null
  line_id: string | null
  room_id: number | null
  room_number: string | null
  room_rent: number | null
  move_in: string | null
  move_out: string | null
  deposit: number
  elec_start: number
  water_start: number
  active: number
  note: string | null
  outstanding: number
}

export interface Bill {
  id: number
  room_id: number
  tenant_id: number | null
  month: string
  rent: number
  elec_prev: number
  elec_curr: number
  elec_rate: number
  water_prev: number
  water_curr: number
  water_rate: number
  other: number
  other_note: string | null
  total: number
  status: 'paid' | 'unpaid'
  paid_at: string | null
  method: string | null
  room_number: string
  floor: number
  tenant_name: string | null
  tenant_phone: string | null
}

export interface MeterRow {
  room_id: number
  number: string
  floor: number
  rent: number
  tenant_id: number
  tenant_name: string
  elec_prev: number
  water_prev: number
  bill: Bill | null
}

export interface Ticket {
  id: number
  room_id: number | null
  room_number: string | null
  title: string
  detail: string | null
  priority: 'high' | 'normal' | 'low'
  status: 'open' | 'in_progress' | 'done'
  cost: number
  created_at: string
  updated_at: string
}

export interface Inquiry {
  id: number
  name: string
  phone: string
  room_type: string | null
  move_in: string | null
  message: string | null
  status: 'new' | 'contacted' | 'closed'
  created_at: string
}

export interface Dashboard {
  month: string
  rooms: { total: number; occupied: number; vacant: number; maintenance: number }
  month_summary: { bills: number; billed: number; collected: number; unpaid_count: number }
  outstanding: { amount: number; count: number }
  trend: { month: string; billed: number; collected: number; elec_units: number; water_units: number }[]
  overdue: Bill[]
  tickets: Ticket[]
  new_inquiries: number
  meter_pending: number
}

export interface PublicInfo {
  name: string
  tagline: string | null
  address: string | null
  phone: string | null
  line_id: string | null
  elec_rate: number
  water_rate: number
  types: { type: string; size: number; min_rent: number; total: number; vacant: number }[]
  vacant_rooms: { number: string; floor: number; type: string; size: number; rent: number }[]
  total_rooms: number
  building: { number: string; floor: number; vacant: boolean }[]
  turnstile_site_key: string | null
}

export type Role = 'owner' | 'staff'
export interface AuthUser { id: number; username: string; name: string; role: Role }
export interface UserRow extends AuthUser { active: number; last_login_at: string | null; created_at: string }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `เกิดข้อผิดพลาด (${res.status})`)
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b: unknown) => request<T>('PUT', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
}
