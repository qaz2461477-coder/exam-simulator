"""
xlsx 題庫轉換腳本
將 4 份 xlsx 題庫轉換為前端可用的 JSON 格式
"""
import json
import os
import openpyxl

SOURCE_DIR = r"D:\code\題庫"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")

FILES = [
    {
        "filename": "交通法規是非題.xlsx",
        "output": "traffic_true_false.json",
        "type": "trueFalse",
        "category": "交通法規",
    },
    {
        "filename": "交通法規選擇題.xlsx",
        "output": "traffic_multiple_choice.json",
        "type": "multipleChoice",
        "category": "交通法規",
    },
    {
        "filename": "機械常識是非題.xlsx",
        "output": "mechanical_true_false.json",
        "type": "trueFalse",
        "category": "機械常識",
    },
    {
        "filename": "機械常識選擇題.xlsx",
        "output": "mechanical_multiple_choice.json",
        "type": "multipleChoice",
        "category": "機械常識",
    },
]


def parse_true_false(ws):
    """解析是非題工作表"""
    questions = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        # 題目欄位 (col 3) 為空則跳過
        question_text = row[2]
        if not question_text or not str(question_text).strip():
            continue

        answer_raw = row[7] if len(row) > 7 else row[6]
        # 嘗試從 col 7 (index 6) 或 col 8 (index 7) 取得答案
        # 是非題的答案欄位位置：交通法規在 col 7, 機械常識在 col 8
        if answer_raw is None and len(row) > 6:
            answer_raw = row[6]

        answer = True if str(answer_raw).strip().upper() == "O" else False
        explanation = None

        # 解析欄位：交通法規在 col 8, 機械常識在 col 9
        for idx in [8, 7]:
            if len(row) > idx and row[idx] is not None:
                exp = str(row[idx]).strip()
                if exp:
                    explanation = exp
                    break

        questions.append({
            "id": int(row[1]),
            "question": str(question_text).strip(),
            "answer": answer,
            "explanation": explanation,
        })
    return questions


def parse_multiple_choice(ws):
    """解析選擇題工作表"""
    questions = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        question_text = row[2]
        if not question_text or not str(question_text).strip():
            continue

        # 選項在 col 4~7 (index 3~6)
        options = []
        for i in range(3, 7):
            if len(row) > i and row[i] is not None:
                opt = str(row[i]).strip()
                if opt:
                    options.append(opt)

        # 答案在 col 8 (index 7)
        answer = int(row[7])

        # 解析在 col 9 (index 8)
        explanation = None
        if len(row) > 8 and row[8] is not None:
            exp = str(row[8]).strip()
            if exp:
                explanation = exp

        questions.append({
            "id": int(row[1]),
            "question": str(question_text).strip(),
            "options": options,
            "answer": answer,
            "explanation": explanation,
        })
    return questions


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for file_config in FILES:
        filepath = os.path.join(SOURCE_DIR, file_config["filename"])
        print(f"處理: {file_config['filename']}")

        wb = openpyxl.load_workbook(filepath)
        ws = wb.active

        if file_config["type"] == "trueFalse":
            questions = parse_true_false(ws)
        else:
            questions = parse_multiple_choice(ws)

        output_data = {
            "type": file_config["type"],
            "category": file_config["category"],
            "questions": questions,
        }

        output_path = os.path.join(OUTPUT_DIR, file_config["output"])
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        print(f"  -> {file_config['output']}: {len(questions)} 題")

    print("\n轉換完成!")


if __name__ == "__main__":
    main()
