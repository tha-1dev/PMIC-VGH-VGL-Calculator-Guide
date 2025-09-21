# PMIC VGH/VGL Calculator & Guide — Imported
# Thai‑Dev Prompts (Compiled)

## 1) RT809F / PMIC Hex ↔ Voltage Calculator
- Goal: ช่วยคำนวณและตรวจช่วงปลอดภัย VGH/VGL/VCOM
- Functions: hex_to_voltage(raw, scale, offset), voltage_to_hex(voltage, scale, offset, bytes)
- Defaults: scale=1.0, offset=0.0 (แก้ตามสูตรของพาเนลได้)
- Safety hints: VGH 26–36V, VGL −18 ถึง −5V (เตือนเมื่อเกิน)
- Output: สูตร, ขั้นตอนคำนวณ, คำแนะนำปรับละเอียด

## 2) I2C/ISP Troubleshooting Guide
- Context: LG/Samsung TCON/PMIC
- Tasks: ระบุขา SDA/SCL, ตรวจ Pull‑up, การต่อ GND/12V, ความยาวสาย, Noise
- Checklist: continuity → pull‑up (2.2–4.7k) → scope edge → re‑seat connector → firmware ID
- Output: ขั้นตอนทีละข้อ + รูปประกอบ

## 3) Looker Studio Dashboard Narration
- Goal: สร้างบทบรรยาย widget (VGH/VGL trend, Safe/Danger overlay)
- Style: สั้น กระชับ 2 ภาษา (ไทย‑อังกฤษ)
- Output: คำอธิบาย Title/Sub‑title/Insight ต่อกราฟ

## 4) Release Post (Facebook/README)
- Goal: ประกาศ patch/อัปเดต
- Structure: Hook → What’s new → How to install → Screenshot/QR → CTA
- Tone: Professional + ชวนทดลอง, แปะ “Powered by Thai‑Dev”

## 5) Dataset Intake Prompt
- Goal: แปลงการวัดภาคสนาม → CSV (timestamp,panel_id,vgh,vgl,vcom,notes)
- Steps: ถามค่า, ตรวจหน่วย, เตือนค่าเกินช่วง, สร้างตาราง CSV ที่โหลดได้

เอกสาร README นี้สร้างอัตโนมัติจากไฟล์ที่อัปโหลด: **pmic-vgh_vgl-calculator-&-guide.zip**  
ตำแหน่งไฟล์ที่แตก: `pmic-app/imported/`

## 📁 โครงสร้าง (ตัวอย่างบางส่วน)
```
.
  metadata.json
  index.css
  Thai-Dev-Voltages-API.postman_collection.json
  VGHVGL.html
  package.json
  index.html
  index.tsx
  tsconfig.json
  vite.config.ts
  .env.local
  .gitignore
  README.md
  api/
    main.py
    panels.json
    schemas.py
  assets/
    pmic.jpg
    lg_pinout.jpg
    ss_pinout.jpg
    vghvglhex.jpg
    00001.jpg
    00002.jpg
	000003.jpg
  data/
    telemetry_sample.csv
  prompts/
    compiled.md
    rt809f_calculator.md
```

## 🔗 ไฟล์หลักที่ตรวจพบ
### HTML
- `VGHVGL.html`
- `index.html`

### JavaScript
- (ไม่พบ JS)

### CSS
- `index.css`

### รูปภาพ
- `assets/pmic.jpg`
- `assets/lg_pinout.jpg`
- `assets/ss_pinout.jpg`
- `assets/vghvglhex.jpg`
- `assets/00001.jpg`
- `assets/00002.jpg`
- `assets/000003.jpg`

## 🚀 วิธีเปิดใช้งาน (ออฟไลน์)
```bash
cd pmic-app/imported
python3 -m http.server 8080
# เปิดเบราว์เซอร์: http://localhost:8080/<ไฟล์หลัก>.html
```

> หมายเหตุ: ถ้าต้องการรวมไฟล์เหล่านี้เข้ากับแอพหลัก ให้บอกผมว่าจะให้วางหน้าไหนเป็น entry (เช่น `index.html`) และมี asset ใดต้องรวม/ย้ายบ้าง ผมจะสร้างสคริปต์ merge ให้ทันที
