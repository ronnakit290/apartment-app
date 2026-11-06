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
- Cloudflare Turnstile (เลือกเปิดได้) ป้องกันบอทที่หน้าล็อกอิน ตั้งค่าครั้งแรก และฟอร์มนัดดูห้อง

## ฐานข้อมูล

Schema อยู่ใน `backend/src/schema.ts` — แก้แล้วรัน `bun run db:generate` เพื่อสร้าง migration
(migration รันอัตโนมัติตอนเปิด server) · `bun run db:studio` เพื่อเปิดดูข้อมูล

## ตัวแปรแวดล้อม

คัดลอก `backend/.env.example` เป็น `backend/.env` (Bun โหลดให้อัตโนมัติ)

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
| --- | --- | --- |
| `PORT` | `3000` | port ของ API |
| `DB_PATH` | `data.sqlite` | ไฟล์ฐานข้อมูล |
| `TURNSTILE_SITE_KEY` | — | Site key ของ Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | — | Secret key ของ Cloudflare Turnstile |
| `API_URL` (frontend) | `http://localhost:3000` | ปลายทาง proxy ของ Vite |

**Turnstile จะเปิดใช้งานเมื่อใส่ทั้ง `TURNSTILE_SITE_KEY` และ `TURNSTILE_SECRET_KEY`** ถ้าไม่ใส่ ระบบทำงานปกติโดยไม่มี Turnstile
frontend รับ site key จาก API เอง ไม่ต้องตั้งค่าฝั่ง frontend

ทดสอบในเครื่องได้ด้วย test keys ของ Cloudflare: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (ผ่านเสมอ)
