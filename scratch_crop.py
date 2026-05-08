import cv2
import numpy as np
import os

def imread_unicode(path):
    stream = open(path, "rb")
    bytes_arr = bytearray(stream.read())
    np_arr = np.asarray(bytes_arr, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img

def imwrite_unicode(path, img):
    is_success, im_buf_arr = cv2.imencode(".png", img)
    im_buf_arr.tofile(path)

def crop_signs_from_image(image_path, output_dir, start_id, expected_count):
    img = imread_unicode(image_path)
    if img is None:
        print(f"Failed to load {image_path}")
        return

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY_INV, 21, 10)
                                   
    kernel = np.ones((7,7), np.uint8)
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
    
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    bounding_boxes = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        if 25000 < area < 800000 and 0.3 < w/h < 3.0:
            bounding_boxes.append((x, y, w, h))
            
    boxes = []
    for box in bounding_boxes:
        x1, y1, w1, h1 = box
        keep = True
        for bx, by, bw, bh in boxes:
            cx1, cy1 = x1 + w1/2, y1 + h1/2
            cx2, cy2 = bx + bw/2, by + bh/2
            dist = np.sqrt((cx1-cx2)**2 + (cy1-cy2)**2)
            if dist < max(w1, h1) * 0.8:
                keep = False
                break
        if keep:
            boxes.append(box)
    
    print(f"Image {image_path}: Found {len(boxes)} valid contours. Expected {expected_count}.")
    
    # We expect the signs to be arranged vertically (the page might be horizontal but signs are in a column)
    # The photos show signs lined up next to questions. Let's assume the largest contours are the signs.
    boxes.sort(key=lambda b: b[2]*b[3], reverse=True)
    boxes = boxes[:expected_count]
    
    # Sort them by their coordinate along the page axis. 
    # Usually they are arranged vertically in portrait, or horizontally in landscape.
    # In IMG_0650 it was horizontal because the photo is rotated. Let's sort by max(x, y).
    # Since the column of signs could be along x or y axis, we can sort by x + y.
    boxes.sort(key=lambda b: b[0] + b[1])
    
    os.makedirs(output_dir, exist_ok=True)
    
    for i, (x, y, w, h) in enumerate(boxes):
        if i >= expected_count: break
        
        pad = 30
        y1 = max(0, y - pad)
        y2 = min(img.shape[0], y + h + pad)
        x1 = max(0, x - pad)
        x2 = min(img.shape[1], x + w + pad)
        
        crop = img[y1:y2, x1:x2]
        out_path = os.path.join(output_dir, f'mc_{start_id + i}.png')
        imwrite_unicode(out_path, crop)
        print(f"Saved {out_path}")

if __name__ == '__main__':
    base_dir = r"C:\Users\MingChang\Desktop\交通法規選擇題"
    out_dir = "D:/code/exam-simulator/images"
    
    tasks = [
        ("IMG_0647.jpeg", 226, 5),
        ("IMG_0648.jpeg", 231, 6),
        ("IMG_0649.jpeg", 237, 6),
        ("IMG_0650.jpeg", 243, 6),
        ("IMG_0651.jpeg", 249, 2)
    ]
    
    for filename, start_id, count in tasks:
        path = os.path.join(base_dir, filename)
        crop_signs_from_image(path, out_dir, start_id, count)
