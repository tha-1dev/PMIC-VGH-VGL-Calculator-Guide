# PMIC VGH/VGL Calculator & Guide — Imported

เอกสาร README นี้สร้างอัตโนมัติจากไฟล์ที่อัปโหลด: **pmic-vgh_vgl-calculator-&-guide (1).zip**  
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
