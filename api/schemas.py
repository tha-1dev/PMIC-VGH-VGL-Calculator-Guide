from pydantic import BaseModel, Field
from typing import Optional

class HexToVoltageRequest(BaseModel):
    param: str = Field(..., examples=["VGH", "VGL", "VCOM"])
    hex_value: str = Field(..., examples=["0x96", "31", "0x038A"])  # 1 หรือ 2 byte
    offset: float = Field(0, description="ค่าชดเชย")
    scale: float = Field(1.0, description="สเกลต่อบิต")

class VoltageToHexRequest(BaseModel):
    param: str
    voltage: float
    bytes: int = Field(1, ge=1, le=2)
    offset: float = 0
    scale: float = 1.0

class VoltageRecord(BaseModel):
    timestamp: str
    panel_id: str
    vgh: float
    vgl: float
    vcom: float

class PanelConvertHexToVoltage(BaseModel):
    panel_id: str
    param: str
    hex_value: str

class PanelConvertVoltageToHex(BaseModel):
    panel_id: str
    param: str
    voltage: float

class CalPoint(BaseModel):
    raw: int
    voltage: float

class PanelCalibrationRequest(BaseModel):
    panel_id: str
    param: str
    p1: CalPoint
    p2: CalPoint
    save: bool = False  # บันทึกปรับสูตรลง panels.json
