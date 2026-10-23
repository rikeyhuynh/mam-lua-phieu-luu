"""Rebuild embedded GLB for opening index.html directly via file://."""
from pathlib import Path
from base64 import b64encode
root = Path(__file__).resolve().parent
source = root / 'Assets' / 'MamMi.glb'
if not source.is_file():
    raise SystemExit('Khong tim thay Assets/MamMi.glb')
data = source.read_bytes()
if data[:4] != b'glTF' or len(data) < 20:
    raise SystemExit('MamMi.glb khong phai file GLB hop le')
encoded = b64encode(data).decode('ascii')
target = root / 'Assets' / 'MamMi-data.js'
target.write_text('// MamMi GLB voi material + texture nhung, dung khi mo index.html truc tiep.\nwindow.MAMMI_GLB_BASE64 = "' + encoded + '";\n', encoding='utf-8')
print(f'Da cap nhat {target.name} tu {source.name} ({len(data):,} bytes)')
