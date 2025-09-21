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
