import { GoogleGenAI } from "@google/genai";

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id: string): HTMLElement | null => document.getElementById(id);
  
  let ai: GoogleGenAI | null = null;
  try {
      ai = new GoogleGenAI({apiKey: process.env.API_KEY!});
  } catch (e) {
      console.error("Failed to initialize GoogleGenAI", e);
  }
  let voltageChart: any = null; // Chart.js instance
  let lastCsvData: any = null; // To store parsed CSV data for Gemini
  let panelProfiles: any = {}; // To store panel data from JSON

  function hexOrDecToInt(txt: string): number {
    if(!txt) return NaN;
    txt = String(txt).trim();
    if(/^0x/i.test(txt)) return parseInt(txt,16);
    if(/^[-+]?\d+$/.test(txt)) return parseInt(txt,10);
    return NaN;
  }

  interface WidthConfig {
    bits: 8 | 16;
    signed: boolean;
    littleEndian: boolean;
  }

  function parseWidthSignedness(width: string): WidthConfig {
    return {
      bits: (width.includes('16') ? 16 : 8),
      signed: width.startsWith('s'),
      littleEndian: width.includes('le')
    };
  }

  function coerceCode(val: number, cfg: WidthConfig): number {
    const bits = cfg.bits;
    const max = (1 << bits) - 1;
    let code = val & max;
    if (cfg.signed) {
      const signBit = 1 << (bits - 1);
      if (code & signBit) {
        code = code - (1 << bits);
      }
    }
    return code;
  }

  function toVoltageLinear(code: number, signal: string, a: number, b: number, vglPol: string): number {
    let V = a * code + b;
    if (signal === 'VGL' && vglPol === 'negative' && V > 0) V = -Math.abs(V);
    return V;
  }

  function fromVoltageLinear(V: number, signal: string, a: number, b: number, vglPol: string): number {
    let target = V;
    if (signal === 'VGL' && vglPol === 'negative' && V > 0) target = -Math.abs(V);
    if (a === 0) return NaN;
    return (target - b) / a;
  }

  interface LutPoint { code: number; V: number; }

  function parseLUT(text: string): LutPoint[] {
    const rows: LutPoint[] = [];
    const lines = (text || '').split(/\r?\n/);
    for(const ln of lines){
      const t = ln.trim();
      if(!t || t.startsWith('#')) continue;
      const parts = t.split(',').map(s=>s.trim());
      if(parts.length<2) continue;
      let code = hexOrDecToInt(parts[0]);
      if(Number.isNaN(code) && parts.length>=2){
        code = hexOrDecToInt(parts[1]);
      }
      const V = parseFloat(parts[parts.length>=3?2:1]);
      if(Number.isFinite(code) && Number.isFinite(V)){
        rows.push({code, V});
      }
    }
    rows.sort((a,b)=>a.code-b.code);
    return rows;
  }

  function interpLUT(code: number, lut: LutPoint[]): number {
    if(!lut || lut.length===0) return NaN;
    if(code<=lut[0].code) return lut[0].V;
    if(code>=lut[lut.length-1].code) return lut[lut.length-1].V;
    for(let i=0;i<lut.length-1;i++){
      const a = lut[i], b = lut[i+1];
      if(code>=a.code && code<=b.code){
        if (b.code === a.code) return a.V;
        const t = (code-a.code)/(b.code-a.code);
        return a.V + t*(b.V-a.V);
      }
    }
    return NaN;
  }

  function invertLUT(V: number, lut: LutPoint[]): number {
    if(!lut || lut.length===0) return NaN;
    for(let i=0;i<lut.length-1;i++){
      const a = lut[i], b = lut[i+1];
      const minV = Math.min(a.V,b.V), maxV = Math.max(a.V,b.V);
      if(V>=minV && V<=maxV){
        if (b.V === a.V) return a.code;
        const t = (V-a.V)/(b.V-a.V);
        return Math.round(a.code + t*(b.code-a.code));
      }
    }
    if(V<=Math.min(lut[0].V, lut[1]?.V ?? lut[0].V)) return lut[0].code;
    const L = lut.length-1;
    if(V>=Math.max(lut[L].V, lut[L-1]?.V ?? lut[L].V)) return lut[L].code;
    return NaN;
  }
  
  async function loadPanelProfiles() {
    const panelSelect = $('panel-select') as HTMLSelectElement;
    try {
      const response = await fetch('api/panels.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      panelProfiles = await response.json();
      
      panelSelect.innerHTML = '<option value="">-- เลือกโปรไฟล์พาแนล --</option>';
      
      for (const panelId in panelProfiles) {
        const option = document.createElement('option');
        option.value = panelId;
        option.textContent = panelId;
        panelSelect.appendChild(option);
      }
    } catch (error) {
      console.error("Failed to load panel profiles:", error);
      panelSelect.innerHTML = '<option value="">-- โหลดโปรไฟล์ล้มเหลว --</option>';
      panelSelect.disabled = true;
    }
  }

  function updateCalculatorFromPanel() {
    const panelId = ($('panel-select') as HTMLSelectElement).value;
    const signal = ($('signal') as HTMLSelectElement).value;

    if (!panelId || !panelProfiles[panelId] || !panelProfiles[panelId][signal]) {
      return;
    }

    const modeSelect = $('mode') as HTMLSelectElement;
    if (modeSelect.value !== 'linear') {
        modeSelect.value = 'linear';
        modeSelect.dispatchEvent(new Event('change'));
    }

    const profile = panelProfiles[panelId][signal];
    const a = profile.scale * (profile.sign || 1);
    const b = profile.offset || 0;

    ($('a') as HTMLInputElement).value = a.toFixed(6);
    ($('b') as HTMLInputElement).value = b.toFixed(6);
  }

  function calcVolt() {
    const signal = ($('signal') as HTMLSelectElement).value;
    const width = ($('width') as HTMLSelectElement).value;
    const cfg = parseWidthSignedness(width);
    const raw = ($('codeIn') as HTMLInputElement).value;
    let code = hexOrDecToInt(raw);
    const voltOut = $('voltOut') as HTMLElement;

    if(Number.isNaN(code)){ 
      voltOut.textContent = 'กรุณากรอกโค้ดเป็น Hex (0x..) หรือเลขฐานสิบ'; 
      return; 
    }
    code = coerceCode(code, cfg);

    const mode = ($('mode') as HTMLSelectElement).value;
    let V = NaN;
    if(mode==='linear'){
      const a = parseFloat(($('a') as HTMLInputElement).value);
      const b = parseFloat(($('b') as HTMLInputElement).value);
      const vglPol = ($('vglPol') as HTMLSelectElement).value;
      V = toVoltageLinear(code, signal, a, b, vglPol);
    }else{
      const lutText = ($('lut') as HTMLTextAreaElement).value;
      const lut = parseLUT(lutText);
      V = interpLUT(code, lut);
    }
    voltOut.textContent = `Code = ${code} → Voltage ≈ ${Number.isFinite(V) ? V.toFixed(3) : 'NaN'} V`;
  }

  function calcCode() {
    const signal = ($('signal') as HTMLSelectElement).value;
    const width = ($('width') as HTMLSelectElement).value;
    const cfg = parseWidthSignedness(width);
    const V = parseFloat(($('voltIn') as HTMLInputElement).value);
    const codeOut = $('codeOut') as HTMLElement;
    
    if(!Number.isFinite(V)){ 
      codeOut.textContent = 'กรุณากรอกแรงดันเป็นตัวเลข'; 
      return; 
    }

    const mode = ($('mode') as HTMLSelectElement).value;
    let code = NaN;
    if(mode==='linear'){
      const a = parseFloat(($('a') as HTMLInputElement).value);
      const b = parseFloat(($('b') as HTMLInputElement).value);
      const vglPol = ($('vglPol') as HTMLSelectElement).value;
      code = Math.round(fromVoltageLinear(V, signal, a, b, vglPol));
    }else{
      const lutText = ($('lut') as HTMLTextAreaElement).value;
      const lut = parseLUT(lutText);
      code = invertLUT(V, lut);
    }
    const bits = cfg.bits;
    const max = (1<<bits)-1;
    let disp = code;
    if(cfg.signed){
      const signBitMax = (1<<(bits-1))-1;
      const signBitMin = -(1<<(bits-1));
      if(code < signBitMin) disp = signBitMin;
      if(code > signBitMax) disp = signBitMax;
    } else {
      if(code<0) disp = 0;
      if(code>max) disp = max;
    }
    codeOut.textContent = `Voltage ≈ ${V.toFixed(3)} V → Code ≈ ${isFinite(disp)?disp:'NaN'} (dec), ${isFinite(disp)?'0x'+(disp & max).toString(16).toUpperCase():'NaN'} (hex)`;
  }

  function solveAB(){
    const c1 = hexOrDecToInt(($('c1') as HTMLInputElement).value);
    const v1 = parseFloat(($('v1') as HTMLInputElement).value);
    const c2 = hexOrDecToInt(($('c2') as HTMLInputElement).value);
    const v2 = parseFloat(($('v2') as HTMLInputElement).value);
    const abOut = $('abOut') as HTMLElement;
    
    if(Number.isNaN(c1)||Number.isNaN(c2)||!Number.isFinite(v1)||!Number.isFinite(v2) || c1===c2){
      abOut.textContent = 'กรุณากรอกข้อมูล 2 จุดให้ถูกต้อง'; return;
    }
    const a = (v2 - v1) / (c2 - c1);
    const b = v1 - a*c1;
    ($('a') as HTMLInputElement).value = a.toFixed(6);
    ($('b') as HTMLInputElement).value = b.toFixed(6);
    abOut.textContent = `ผลคาลิเบรต: a = ${a.toFixed(6)} V/LSB, b = ${b.toFixed(6)} V\n(ตั้งค่าให้กับโหมดเชิงเส้นแล้ว)`;
  }
  
  function presetVGH(){
    ($('signal') as HTMLSelectElement).value='VGH';
    ($('width') as HTMLSelectElement).value='u16le';
    ($('mode') as HTMLSelectElement).value='linear';
    ($('a') as HTMLInputElement).value='0.2000';
    ($('b') as HTMLInputElement).value='0.0000';
    ($('vglPol') as HTMLSelectElement).value='negative';
    ($('linearBox') as HTMLElement).style.display='grid'; 
    ($('lutBox') as HTMLElement).style.display='none';
  }

  function presetVGL(){
    ($('signal') as HTMLSelectElement).value='VGL';
    ($('width') as HTMLSelectElement).value='s8';
    ($('mode') as HTMLSelectElement).value='linear';
    ($('a') as HTMLInputElement).value='-0.2000';
    ($('b') as HTMLInputElement).value='0.0000';
    ($('vglPol') as HTMLSelectElement).value='negative';
    ($('linearBox') as HTMLElement).style.display='grid'; 
    ($('lutBox') as HTMLElement).style.display='none';
  }

  function loadSampleLUT(){
    ($('signal') as HTMLSelectElement).value='VGL';
    ($('width') as HTMLSelectElement).value='s8';
    ($('mode') as HTMLSelectElement).value='lut';
    ($('linearBox') as HTMLElement).style.display='none';
    ($('lutBox') as HTMLElement).style.display='block';
    ($('lut') as HTMLTextAreaElement).value = `0x1E,30,-6.5
0x2E,46,-9.3
0x31,49,-10.0
0x38,56,-5.42
0x3E,62,-12.0
0x42,66,-13.0
0x46,70,-14.0
0x4A,74,-15.0
0x4E,78,-16.0
0x52,82,-17.0
0x56,86,-18.0`;
  }

  // --- CSV Visualizer Functions ---
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const statusEl = $('csvStatus');
    const chartContainer = $('chartContainer');
  
    if (!input.files || input.files.length === 0) {
      if(statusEl) statusEl.textContent = 'ไม่ได้เลือกไฟล์';
      return;
    }
  
    const file = input.files[0];
    if (!file.name.endsWith('.csv')) {
        if(statusEl) statusEl.textContent = 'ข้อผิดพลาด: โปรดเลือกไฟล์ .csv เท่านั้น';
        return;
    }
  
    if(statusEl) statusEl.textContent = `กำลังอ่านไฟล์: ${file.name}...`;
    if(chartContainer) chartContainer.style.display = 'none';
  
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        renderChart(data);
        if(statusEl) statusEl.textContent = `แสดงผลข้อมูลจาก: ${file.name}`;
        if(chartContainer) chartContainer.style.display = 'block';

        // Store data and show Gemini UI
        lastCsvData = data;
        const geminiContainer = $('gemini-analysis-container');
        if (geminiContainer) {
            geminiContainer.style.display = 'block';
        }
        const geminiOutput = $('geminiOutput');
        if (geminiOutput) {
            geminiOutput.innerHTML = ''; // Clear previous results
        }
        const analyzeBtn = $('analyzeBtn') as HTMLButtonElement;
        if(analyzeBtn) analyzeBtn.disabled = !ai; // Disable if AI failed to init

      } catch (error: any) {
        if(statusEl) statusEl.textContent = `ข้อผิดพลาด: ${error.message}`;
        if(chartContainer) chartContainer.style.display = 'none';
        
        const geminiContainer = $('gemini-analysis-container');
        if (geminiContainer) {
            geminiContainer.style.display = 'none';
        }
        lastCsvData = null;
      }
    };
    reader.onerror = () => {
      if(statusEl) statusEl.textContent = 'ไม่สามารถอ่านไฟล์ได้';
    };
    reader.readAsText(file);
  }
  
  function parseCSV(csvText: string) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('CSV ต้องมีอย่างน้อยหนึ่งแถวข้อมูลและหนึ่งแถวหัวข้อ');
    }
  
    const header = lines[0].split(',').map(h => h.trim());
    const requiredCols = ['timestamp', 'vgh', 'vgl', 'vcom'];
    const colIndices: { [key: string]: number } = {};
  
    requiredCols.forEach(col => {
      const index = header.indexOf(col);
      if (index === -1) {
        throw new Error(`คอลัมน์ที่ต้องการ '${col}' ไม่พบในไฟล์ CSV`);
      }
      colIndices[col] = index;
    });
  
    const labels: string[] = [];
    const vghData: number[] = [];
    const vglData: number[] = [];
    const vcomData: number[] = [];
  
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue; // Skip empty lines
        const values = lines[i].split(',');
        if (values.length < header.length) continue; // Skip malformed lines
        labels.push(values[colIndices['timestamp']].trim());
        vghData.push(parseFloat(values[colIndices['vgh']]));
        vglData.push(parseFloat(values[colIndices['vgl']]));
        vcomData.push(parseFloat(values[colIndices['vcom']]));
    }
  
    return { labels, vghData, vglData, vcomData };
  }
  
  function renderChart(data: { labels: string[], vghData: number[], vglData: number[], vcomData: number[] }) {
    const ctx = ($('voltageChart') as HTMLCanvasElement)?.getContext('2d');
    if (!ctx) return;
  
    if (voltageChart) {
      voltageChart.destroy();
    }
    
    const style = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--accent').trim();
    const warnColor = style.getPropertyValue('--warn').trim();
    const accent2Color = style.getPropertyValue('--accent2').trim();
    const inkColor = style.getPropertyValue('--ink').trim();
    const mutedColor = style.getPropertyValue('--muted').trim();
    const borderColor = style.getPropertyValue('--border').trim();
  
    voltageChart = new (window as any).Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'VGH',
            data: data.vghData,
            borderColor: accentColor,
            backgroundColor: `${accentColor}33`,
            tension: 0.2,
            fill: false,
          },
          {
            label: 'VGL',
            data: data.vglData,
            borderColor: warnColor,
            backgroundColor: `${warnColor}33`,
            tension: 0.2,
            fill: false,
          },
          {
            label: 'VCOM',
            data: data.vcomData,
            borderColor: accent2Color,
            backgroundColor: `${accent2Color}33`,
            tension: 0.2,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: inkColor, font: { size: 14 } }
          },
          tooltip: {
              backgroundColor: 'rgba(11, 13, 16, 0.9)',
              titleColor: inkColor,
              bodyColor: inkColor,
              borderColor: borderColor,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
          }
        },
        scales: {
          x: {
            ticks: { color: mutedColor },
            grid: { color: borderColor }
          },
          y: {
            ticks: { color: mutedColor },
            grid: { color: borderColor }
          }
        },
        interaction: {
            intersect: false,
            mode: 'index',
        },
      }
    });
  }

  // --- Gemini AI Analysis Functions ---
  function markdownToHtml(md: string): string {
    return md
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/^\s*[-*] (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
      .replace(/<ul><br>/g, '<ul>')
      .replace(/<br><\/ul>/g, '</ul>')
      .replace(/<\/li><br>/g, '</li>');
  }

  async function analyzeWithGemini() {
    if (!lastCsvData || !ai) {
      ($('geminiOutput') as HTMLElement).textContent = 'ไม่มีข้อมูลให้วิเคราะห์ หรือ AI ไม่พร้อมใช้งาน';
      return;
    }

    const analyzeBtn = $('analyzeBtn') as HTMLButtonElement;
    const geminiOutput = $('geminiOutput') as HTMLElement;

    analyzeBtn.disabled = true;
    geminiOutput.innerHTML = 'กำลังวิเคราะห์ข้อมูลด้วย Gemini... โปรดรอสักครู่';

    try {
      const { labels, vghData, vglData, vcomData } = lastCsvData;
      
      const dataSummary = `
Data points: ${labels.length}
VGH range: ${Math.min(...vghData).toFixed(2)}V to ${Math.max(...vghData).toFixed(2)}V
VGL range: ${Math.min(...vglData).toFixed(2)}V to ${Math.max(...vglData).toFixed(2)}V
VCOM range: ${Math.min(...vcomData).toFixed(2)}V to ${Math.max(...vcomData).toFixed(2)}V

First 10 data points (timestamp, VGH, VGL, VCOM):
${labels.slice(0, 10).map((label, index) => 
    `- ${label}, ${vghData[index].toFixed(2)}V, ${vglData[index].toFixed(2)}V, ${vcomData[index].toFixed(2)}V`
).join('\n')}
      `;

      const prompt = `คุณคือช่างซ่อมทีวีผู้เชี่ยวชาญและนักวิเคราะห์ข้อมูลที่เชี่ยวชาญด้านปัญหาแรงดัน PMIC (VGH, VGL, VCOM) โดยเฉพาะ ให้วิเคราะห์ข้อมูลแรงดันไฟฟ้าแบบอนุกรมเวลาต่อไปนี้จากพาแนลทีวี และตอบกลับเป็นภาษาไทยเท่านั้น

วิเคราะห์ข้อมูลและสร้างรายงานที่กระชับและนำไปปฏิบัติได้ โดยมีหัวข้อต่อไปนี้:
1.  **สรุปแนวโน้ม (Trend Summary):** ภาพรวมสั้นๆ เกี่ยวกับเสถียรภาพและระดับของ VGH, VGL และ VCOM
2.  **ประเด็นที่น่ากังวล (Potential Issues):** ระบุแรงดันไฟฟ้าที่อยู่นอกช่วงที่ปลอดภัย (VGH: 21–24V คือค่าที่เหมาะสมสำหรับงานซ่อม, VGL: −12 ถึง −18V คือค่าที่เหมาะสมสำหรับงานซ่อม) หรือสัญญาณของความไม่เสถียร, ripple, หรือการตก/พุ่งอย่างกะทันหัน
3.  **คำแนะนำสำหรับช่าง (Recommendations):** ให้ขั้นตอนที่ชัดเจนสำหรับช่างเทคนิค เช่น "แนะนำให้ปรับลด VGH ลงเล็กน้อยเพื่อยืดอายุ COF" หรือ "VGL มีค่าไม่เป็นลบเพียงพอ อาจทำให้เกิดเส้นสว่างแนวนอน ควรปรับเพิ่มความเป็นลบ"

ใช้ Markdown สำหรับจัดรูปแบบคำตอบของคุณ (ใช้ ### สำหรับหัวข้อ)

นี่คือข้อมูลสรุป:
${dataSummary}
`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      geminiOutput.innerHTML = markdownToHtml(response.text);

    } catch (error) {
      console.error('Gemini API error:', error);
      geminiOutput.textContent = 'เกิดข้อผิดพลาดในการสื่อสารกับ Gemini API กรุณาลองใหม่อีกครั้ง';
    } finally {
      analyzeBtn.disabled = false;
    }
  }
  
  // Event Listeners
  $('mode')?.addEventListener('change', e => {
    const linear = (e.target as HTMLSelectElement).value === 'linear';
    ($('linearBox') as HTMLElement).style.display = linear?'grid':'none';
    ($('lutBox') as HTMLElement).style.display = linear?'none':'block';
  });

  $('panel-select')?.addEventListener('change', updateCalculatorFromPanel);
  $('signal')?.addEventListener('change', updateCalculatorFromPanel);
  
  $('calcVoltBtn')?.addEventListener('click', calcVolt);
  $('calcCodeBtn')?.addEventListener('click', calcCode);
  $('solveABBtn')?.addEventListener('click', solveAB);
  $('presetVGHBtn')?.addEventListener('click', presetVGH);
  $('presetVGLBtn')?.addEventListener('click', presetVGL);
  $('loadSampleLUTBtn')?.addEventListener('click', loadSampleLUT);
  $('csvFileInput')?.addEventListener('change', handleFileSelect);
  $('analyzeBtn')?.addEventListener('click', analyzeWithGemini);

  loadPanelProfiles();
});