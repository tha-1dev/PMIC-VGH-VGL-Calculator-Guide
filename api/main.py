import os, json
from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from dotenv import load_dotenv
from .schemas import (
    HexToVoltageRequest, VoltageToHexRequest,
    PanelConvertHexToVoltage, PanelConvertVoltageToHex,
    PanelCalibrationRequest
)
from .utils.hex_voltage import parse_hex_value, hex_to_voltage, voltage_to_hex
import pandas as pd
from io import StringIO

load_dotenv()
API_KEY = os.getenv("API_KEY", "changeme")

app = FastAPI(title="Thai-Dev Voltages API", version="1.1.0", description="API แปลงค่า Hex↔Voltage + Telemetry + Panel config")


def _load_panels():
    p = os.path.join(os.path.dirname(__file__), "panels.json")
    if not os.path.exists(p):
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_panels(obj):
    p = os.path.join(os.path.dirname(__file__), "panels.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

async def require_key(request: Request, x_api_key: str | None = Header(default=None)):
    # fallback: ?key= สำหรับ data source ที่ไม่ส่ง header
    key = x_api_key or request.query_params.get("key")
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.get("/health")
async def health():
    return {"ok": True}

@app.get("/v1/voltages")
async def get_voltages(panel_id: str = "DEFAULT", _: None = Depends(require_key)):
    panels = _load_panels()
    cfg = panels.get(panel_id) or panels.get("DEFAULT")
    sample = {
        "panel_id": panel_id,
        "VGH": 29.62,
        "VGL": -7.82,
        "VCOM": -1.20,
        "meta": {
            "range": {"VGH": [26, 36], "VGL": [-18, -5]},
            "notes": "ปรับให้เหมาะตามพาเนล",
            "panel_cfg": cfg
        }
    }
    return sample

@app.post("/v1/convert/hex-to-voltage")
async def api_hex_to_voltage(req: HexToVoltageRequest, _: None = Depends(require_key)):
    raw = parse_hex_value(req.hex_value)
    v = hex_to_voltage(raw, req.scale, req.offset)
    return {"param": req.param, "hex": req.hex_value, "voltage": v}

@app.post("/v1/convert/voltage-to-hex")
async def api_voltage_to_hex(req: VoltageToHexRequest, _: None = Depends(require_key)):
    hx = voltage_to_hex(req.voltage, req.scale, req.offset, req.bytes)
    return {"param": req.param, "voltage": req.voltage, "hex": hx, "bytes": req.bytes}

# Panel-aware conversion
@app.get("/v1/panels")
async def get_panels(_: None = Depends(require_key)):
    return _load_panels()

@app.post("/v1/convert/panel/hex-to-voltage")
async def panel_hex_to_voltage(req: PanelConvertHexToVoltage, _: None = Depends(require_key)):
    panels = _load_panels()
    cfg = (panels.get(req.panel_id) or {}).get(req.param)
    if not cfg:
        raise HTTPException(404, detail="panel/param not found")
    raw = parse_hex_value(req.hex_value)
    v = (raw * float(cfg.get("scale",1.0)) + float(cfg.get("offset",0.0))) * int(cfg.get("sign",1))
    return {"panel_id": req.panel_id, "param": req.param, "hex": req.hex_value, "voltage": v, "cfg": cfg}

@app.post("/v1/convert/panel/voltage-to-hex")
async def panel_voltage_to_hex(req: PanelConvertVoltageToHex, _: None = Depends(require_key)):
    panels = _load_panels()
    cfg = (panels.get(req.panel_id) or {}).get(req.param)
    if not cfg:
        raise HTTPException(404, detail="panel/param not found")
    sign = int(cfg.get("sign",1))
    scale = float(cfg.get("scale",1.0))
    offset = float(cfg.get("offset",0.0))
    bytes_ = int(cfg.get("bytes",1))
    target = req.voltage * sign
    hx = voltage_to_hex(target, scale, offset, bytes_)
    return {"panel_id": req.panel_id, "param": req.param, "voltage": req.voltage, "hex": hx, "cfg": cfg}

@app.post("/v1/panels/calibrate")
async def panel_calibrate(req: PanelCalibrationRequest, _: None = Depends(require_key)):
    # Two-point: v = m*raw + b  (after sign applied)
    r1, v1 = req.p1.raw, req.p1.voltage
    r2, v2 = req.p2.raw, req.p2.voltage
    if r1 == r2:
        raise HTTPException(400, detail="raw points must differ")
    m = (v2 - v1) / (r2 - r1)
    b = v1 - m * r1
    result = {"scale": abs(m), "offset": b if m >= 0 else -b, "sign": 1 if m >= 0 else -1}
    if req.save:
        panels = _load_panels()
        if req.panel_id not in panels:
            panels[req.panel_id] = {}
        meta = panels[req.panel_id].get(req.param, {"bytes": 1})
        meta.update({"scale": abs(m), "offset": 0.0 if req.param.upper()=="VGH" else 0.0, "sign": 1 if m >= 0 else -1})
        panels[req.panel_id][req.param] = meta
        _save_panels(panels)
    return {"panel_id": req.panel_id, "param": req.param, "m": m, "b": b, "derived": result}

@app.get("/v1/telemetry")
async def telemetry(_: None = Depends(require_key)):
    df = pd.read_csv("data/telemetry_sample.csv")
    return df.to_dict(orient="records")

@app.get("/v1/telemetry.csv")
async def telemetry_csv(_: None = Depends(require_key)):
    df = pd.read_csv("data/telemetry_sample.csv")
    buf = StringIO()
    df.to_csv(buf, index=False)
    return PlainTextResponse(content=buf.getvalue(), media_type="text/csv")
