import json

with open('data/traffic_multiple_choice.json', encoding='utf-8') as f:
    data = json.load(f)

updated = 0
for q in data['questions']:
    qid = q.get('id', 0)
    if 226 <= qid <= 250:
        q['imagePath'] = f'images/mc_{qid}.png'
        updated += 1

with open('data/traffic_multiple_choice.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'已更新 {updated} 題，加入 imagePath 欄位 (mc_226.png - mc_250.png)')
