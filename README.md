# Nisia Residence — ระบบจัดการหอพัก

Landing page สำหรับหาผู้เช่า + Dashboard สำหรับเจ้าของ/พนักงานหอพัก

- **frontend/** — React 19 + Vite + Motion (Framer Motion)
- **backend/** — Bun + Hono + drizzle-orm (SQLite)

## เริ่มใช้งาน

```bash
cd backend && bun install && bun run dev     # API → http://localhost:3000
cd frontend && bun install && bun run dev    # Web → http://localhost:5173
```

- หน้าเว็บไซต์: `http://localhost:5173/#/`
- Dashboard: `http://localhost:5173/#/app` — เปิดครั้งแรกจะให้สร้างบัญชีเจ้าของหอ

ฐานข้อมูลถูกสร้างที่ `backend/data.sqlite` พร้อมข้อมูลตัวอย่าง (ห้อง ผู้เช่า บิล 6 เดือน) ในการรันครั้งแรก
ลบไฟล์นี้เพื่อเริ่มใหม่

## ฟีเจอร์

- ภาพรวม: อัตราเข้าพัก รายรับ ยอดค้าง กราฟ 6 เดือน
- ห้องพัก / ผู้เช่า (ย้ายเข้า-ออก) / จดมิเตอร์และออกบิลทั้งตึก
- บิล & รับชำระ พร้อมพิมพ์ใบแจ้งหนี้/ใบเสร็จ
- แจ้งซ่อม (kanban) / ผู้สนใจเช่าจากฟอร์มหน้าเว็บ
- ระบบล็อกอิน: session cookie (httpOnly), argon2 password hash, สิทธิ์เจ้าของ/พนักงาน, จำกัดการเดารหัสผ่าน

## ฐานข้อมูล

Schema อยู่ใน `backend/src/schema.ts` — แก้แล้วรัน `bun run db:generate` เพื่อสร้าง migration
(migration รันอัตโนมัติตอนเปิด server) · `bun run db:studio` เพื่อเปิดดูข้อมูล

ตัวแปรแวดล้อม: `PORT` (default 3000), `DB_PATH` (default `data.sqlite`), `API_URL` สำหรับ Vite proxy
