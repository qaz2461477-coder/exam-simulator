import os
import glob
import re
import json

image_dir = 'images'
json_path = 'data/traffic_multiple_choice.json'

# 1. Normalize filenames
print("--- 檢查與正規化檔案名稱 ---")
renamed_count = 0
for filename in os.listdir(image_dir):
    # Match patterns like mc-242.png, ms_241.jpg, MC_226.jpeg, etc.
    match = re.match(r'm[cs][_-](\d{3})\.(png|jpg|jpeg)$', filename, re.IGNORECASE)
    if match:
        qid = match.group(1)
        ext = match.group(2).lower()
        if 226 <= int(qid) <= 250:
            expected_name = f'mc_{qid}.{ext}'
            if filename != expected_name:
                old_path = os.path.join(image_dir, filename)
                new_path = os.path.join(image_dir, expected_name)
                if os.path.exists(new_path):
                    # Expected file already exists, probably a duplicate. We can remove the badly named one.
                    os.remove(old_path)
                    print(f"刪除重複檔案: {filename}")
                else:
                    os.rename(old_path, new_path)
                    print(f"重新命名: {filename} -> {expected_name}")
                    renamed_count += 1

if renamed_count == 0:
    print("沒有需要重新命名的檔案。")

# 2. Map available images
print("\n--- 對應圖片與更新 JSON ---")
image_map = {} # qid -> filename
for filename in os.listdir(image_dir):
    match = re.match(r'mc_(\d{3})\.(png|jpg|jpeg)$', filename, re.IGNORECASE)
    if match:
        qid = int(match.group(1))
        if 226 <= qid <= 250:
            # Prefer png if there are duplicates
            if qid in image_map and image_map[qid].endswith('.png') and filename.endswith(('.jpg', '.jpeg')):
                continue
            image_map[qid] = filename

missing = []
for i in range(226, 251):
    if i not in image_map:
        missing.append(i)

if missing:
    print(f"警告: 缺少以下題號的圖片: {missing}")

# 3. Update JSON
with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

updated = 0
for q in data['questions']:
    qid = q.get('id', 0)
    if 226 <= qid <= 250:
        if qid in image_map:
            q['imagePath'] = f'images/{image_map[qid]}'
            updated += 1
        else:
            print(f"無法為題目 {qid} 更新 imagePath (找不到圖片)")

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n成功為 {updated} 題更新 imagePath。")
