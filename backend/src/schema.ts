import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const now = sql`(datetime('now'))`

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  address: text('address'),
  phone: text('phone'),
  line_id: text('line_id'),
  elec_rate: real('elec_rate').notNull().default(7),
  water_rate: real('water_rate').notNull().default(18),
  due_day: integer('due_day').notNull().default(5),
  late_fee: real('late_fee').notNull().default(50),
  bank_name: text('bank_name'),
  bank_account: text('bank_account'),
  bank_holder: text('bank_holder'),
})

export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey(),
  number: text('number').notNull().unique(),
  floor: integer('floor').notNull(),
  type: text('type').notNull(),
  size: real('size'),
  rent: real('rent').notNull(),
  maintenance: integer('maintenance').notNull().default(0),
  note: text('note'),
})

export const tenants = sqliteTable('tenants', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  line_id: text('line_id'),
  room_id: integer('room_id').references(() => rooms.id),
  move_in: text('move_in'),
  move_out: text('move_out'),
  deposit: real('deposit').notNull().default(0),
  elec_start: real('elec_start').notNull().default(0),
  water_start: real('water_start').notNull().default(0),
  active: integer('active').notNull().default(1),
  note: text('note'),
})

export const bills = sqliteTable(
  'bills',
  {
    id: integer('id').primaryKey(),
    room_id: integer('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    tenant_id: integer('tenant_id').references(() => tenants.id),
    month: text('month').notNull(),
    rent: real('rent').notNull(),
    elec_prev: real('elec_prev').notNull(),
    elec_curr: real('elec_curr').notNull(),
    elec_rate: real('elec_rate').notNull(),
    water_prev: real('water_prev').notNull(),
    water_curr: real('water_curr').notNull(),
    water_rate: real('water_rate').notNull(),
    other: real('other').notNull().default(0),
    other_note: text('other_note'),
    total: real('total').notNull(),
    status: text('status', { enum: ['paid', 'unpaid'] }).notNull().default('unpaid'),
    paid_at: text('paid_at'),
    method: text('method'),
    created_at: text('created_at').notNull().default(now),
  },
  (t) => [uniqueIndex('bills_room_month').on(t.room_id, t.month)],
)

export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  room_id: integer('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  detail: text('detail'),
  priority: text('priority', { enum: ['high', 'normal', 'low'] }).notNull().default('normal'),
  status: text('status', { enum: ['open', 'in_progress', 'done'] }).notNull().default('open'),
  cost: real('cost').notNull().default(0),
  created_at: text('created_at').notNull().default(now),
  updated_at: text('updated_at').notNull().default(now),
})

export const inquiries = sqliteTable('inquiries', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  room_type: text('room_type'),
  move_in: text('move_in'),
  message: text('message'),
  status: text('status', { enum: ['new', 'contacted', 'closed'] }).notNull().default('new'),
  created_at: text('created_at').notNull().default(now),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  password_hash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'staff'] }).notNull().default('staff'),
  active: integer('active').notNull().default(1),
  last_login_at: text('last_login_at'),
  created_at: text('created_at').notNull().default(now),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // sha256 of the cookie token
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires_at: integer('expires_at').notNull(), // unix ms
  created_at: text('created_at').notNull().default(now),
})
