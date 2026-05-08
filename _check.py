import sys; sys.stdout.reconfigure(encoding='utf-8')
import json

for fname, label in [('data/traffic_true_false.json','交通法規是非題'),
                     ('data/traffic_multiple_choice.json','交通法規選擇題')]:
    with open(fname, encoding='utf-8') as f:
        d = json.load(f)
    print(f'=== {label} 226-250 ===')
    for q in d['questions'][225:250]:
        print(f"  id={q['id']}  {q['question'][:80]}")
    print()
