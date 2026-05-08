"""
更新 data/traffic_true_false.json
為 id 226-250 的題目加入 imagePath 欄位
"""
import json

with open('data/traffic_true_false.json', encoding='utf-8') as f:
    data = json.load(f)

updated = 0
for q in data['questions']:
    qid = q.get('id', 0)
    if 226 <= qid <= 250:
        q['imagePath'] = f'images/tf_{qid}.png'
        updated += 1

with open('data/traffic_true_false.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'已更新 {updated} 題，加入 imagePath 欄位')

# 驗證
for q in data['questions']:
    if 226 <= q.get('id', 0) <= 228:
        print(json.dumps(q, ensure_ascii=False, indent=2))
