"""
整合：
1. 把 AI 生成的圖片（存在 brain 資料夾）複製到 images/
2. 列出所有 25 張圖的狀態
"""
import shutil
import os

brain_dir = r'C:\Users\MingChang\.gemini\antigravity\brain\fbfa59dd-10d0-4b04-836f-2c657854bb2a'
dest_dir = 'images'
os.makedirs(dest_dir, exist_ok=True)

# AI 生成的圖片對應（brain 資料夾的檔名 → 目標檔名）
ai_images = {
    'tf_226_1778266666814.png': 'tf_226.png',
    'tf_227_1778266741593.png': 'tf_227.png',
    'tf_228_1778266754007.png': 'tf_228.png',
    'tf_229_1778266776712.png': 'tf_229.png',
    'tf_230_1778266790058.png': 'tf_230.png',
    'tf_231_1778266804420.png': 'tf_231.png',
    'tf_232_1778266826323.png': 'tf_232.png',
    'tf_233_1778266922755.png': 'tf_233.png',
    'tf_234_1778266854959.png': 'tf_234.png',
    'tf_235_1778266937496.png': 'tf_235.png',
    'tf_236_1778266951114.png': 'tf_236.png',
    'tf_237_1778266971404.png': 'tf_237.png',
    'tf_238_1778266981842.png': 'tf_238.png',
    'tf_239_1778266996532.png': 'tf_239.png',
    'tf_240_1778267018367.png': 'tf_240.png',
    'tf_241_1778267029910.png': 'tf_241.png',
}

print('=== 複製 AI 生成圖片 ===')
for src_name, dest_name in ai_images.items():
    src = os.path.join(brain_dir, src_name)
    dest = os.path.join(dest_dir, dest_name)
    if os.path.exists(src):
        shutil.copy2(src, dest)
        print(f'  OK: {src_name} -> {dest_name}')
    else:
        print(f'  MISS: {src_name}')

print()
print('=== 全部 25 張狀態 ===')
for i in range(226, 251):
    filename = f'tf_{i}.png'
    path = os.path.join(dest_dir, filename)
    if os.path.exists(path):
        size = os.path.getsize(path)
        status = 'OK' if size > 1000 else 'SMALL'
        print(f'  {filename}: {size} bytes [{status}]')
    else:
        print(f'  {filename}: 缺失')
