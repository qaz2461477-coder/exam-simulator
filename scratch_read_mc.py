import json

with open('D:/code/exam-simulator/data/traffic_multiple_choice.json', encoding='utf-8') as f:
    data = json.load(f)

with open('D:/code/exam-simulator/scratch_out_mc.txt', 'w', encoding='utf-8') as out:
    for q in data['questions']:
        if 226 <= q['id'] <= 250:
            out.write(f"{q['id']}: {q['question']}\n")
            out.write(f"  Options: {q['options']}\n")
