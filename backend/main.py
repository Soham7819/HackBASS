import os
import cv2
import math
import numpy as np
import json
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import LineString, box
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI(title="BIM AI Pipeline - Advanced Vision Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MATERIAL_DB = [
    {"name": "AAC Blocks", "cost": 1, "strength": 2, "durability": 3, "allowed": ["partition"]},
    {"name": "Red Brick", "cost": 2, "strength": 3, "durability": 2, "allowed": ["load_bearing"]},
    {"name": "RCC", "cost": 3, "strength": 4, "durability": 4, "allowed": ["load_bearing", "slab", "column"]},
    {"name": "Steel Frame", "cost": 3, "strength": 4, "durability": 4, "allowed": ["load_bearing", "window_frames"]}, 
    {"name": "Hollow Concrete Block", "cost": 1.5, "strength": 2, "durability": 2, "allowed": ["partition"]},
    {"name": "Fly Ash Brick", "cost": 1, "strength": 2.5, "durability": 3, "allowed": ["partition", "load_bearing"]},
    {"name": "Precast Concrete Panel", "cost": 2.5, "strength": 3, "durability": 4, "allowed": ["load_bearing", "slab"]}
]

def extract_text_from_image(image_bytes: bytes):
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract all readable room names and dimensions. Return a comma-separated list."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                }
            ],
            temperature=0.1 
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Groq OCR Vision extraction failed: {str(e)}"

# ==========================================
# WINDOW EXTRACTION (Stairs Removed)
# ==========================================
def detect_windows(walls):
    windows = []
    
    # WINDOW DETECTION (Tolerant Gap Finding)
    for i, w1 in enumerate(walls):
        for j, w2 in enumerate(walls):
            if i >= j: continue
            
            # Walls must have roughly the same rotation
            if abs(w1["rotation"] - w2["rotation"]) < 0.1:
                is_horiz = abs(w1["rotation"]) < 0.1 or abs(w1["rotation"] - math.pi) < 0.1
                is_vert = abs(abs(w1["rotation"]) - math.pi/2) < 0.1

                if is_horiz:
                    # Check if they lie on the same Z axis (allow 0.5m wiggle room)
                    if abs(w1["position"]["z"] - w2["position"]["z"]) < 0.5:
                        gap = abs(w1["position"]["x"] - w2["position"]["x"]) - (w1["length"]/2 + w2["length"]/2)
                        # Valid window sizes are usually between 0.5m and 3m
                        if 0.5 < gap < 3.0: 
                            center_x = (w1["position"]["x"] + w2["position"]["x"]) / 2
                            windows.append({
                                "id": f"win_{len(windows)}",
                                "length": gap,
                                "position": {"x": center_x, "y": 1.5, "z": w1["position"]["z"]},
                                "rotation": w1["rotation"]
                            })
                            
                elif is_vert:
                    # Check if they lie on the same X axis
                    if abs(w1["position"]["x"] - w2["position"]["x"]) < 0.5:
                        gap = abs(w1["position"]["z"] - w2["position"]["z"]) - (w1["length"]/2 + w2["length"]/2)
                        if 0.5 < gap < 3.0:
                            center_z = (w1["position"]["z"] + w2["position"]["z"]) / 2
                            windows.append({
                                "id": f"win_{len(windows)}",
                                "length": gap,
                                "position": {"x": w1["position"]["x"], "y": 1.5, "z": center_z},
                                "rotation": w1["rotation"]
                            })

    # Deduplicate windows that might overlap due to tolerant grouping
    unique_windows = []
    for w in windows:
        is_duplicate = any(math.hypot(w["position"]["x"] - ew["position"]["x"], w["position"]["z"] - ew["position"]["z"]) < 0.5 for ew in unique_windows)
        if not is_duplicate: unique_windows.append(w)

    return unique_windows

def process_floorplan(image_bytes: bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    _, thresh = cv2.threshold(img, 220, 255, cv2.THRESH_BINARY_INV)
    
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
    h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, h_kernel, iterations=2)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))
    v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, v_kernel, iterations=2)
    
    clean_mask = cv2.add(h_lines, v_lines)
    lines = cv2.HoughLinesP(clean_mask, 1, np.pi/180, threshold=50, minLineLength=40, maxLineGap=10)
    
    if lines is None: return [], {}, [], 0

    all_x, all_y = [], []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        all_x.extend([x1, x2]); all_y.extend([y1, y2])
        
    min_x, max_x, min_y, max_y = min(all_x), max(all_x), min(all_y), max(all_y)
    margin_x, margin_y = (max_x - min_x) * 0.05, (max_y - min_y) * 0.05
    outer_bounds = box(min_x + margin_x, min_y + margin_y, max_x - margin_x, max_y - margin_y)

    walls = []
    scale = 0.02
    max_span = 0

    for i, line in enumerate(lines):
        x1, y1, x2, y2 = line[0]
        line_geom = LineString([(x1, y1), (x2, y2)])
        is_outer = not outer_bounds.contains(line_geom)
        wall_type = "load_bearing" if is_outer else "partition"
        
        length_m = math.sqrt((x2 - x1)**2 + (y2 - y1)**2) * scale
        if wall_type == "load_bearing" and length_m > max_span: 
            max_span = length_m
            
        center_x = ((x1 + x2) / 2) * scale - ((max_x * scale)/2)
        center_z = ((y1 + y2) / 2) * scale - ((max_y * scale)/2)
        angle = math.atan2(y2 - y1, x2 - x1)
        
        walls.append({
            "id": f"wall_{i}", "type": wall_type, "length": length_m,
            "position": {"x": center_x, "y": 1.5, "z": center_z}, "rotation": -angle 
        })
        
    slab = {"width": (max_x - min_x) * scale, "depth": (max_y - min_y) * scale}
    
    # Only detect windows now
    windows = detect_windows(walls)
        
    return walls, slab, windows, max_span

def calculate_tradeoffs(element_type: str, max_span: float):
    results = []
    if element_type == "load_bearing": w_cost, w_strength, w_durability = 0.2, 0.6, 0.2
    elif element_type == "partition": w_cost, w_strength, w_durability = 0.6, 0.1, 0.3
    else: w_cost, w_strength, w_durability = 0.1, 0.5, 0.4

    for mat in MATERIAL_DB:
        if element_type in mat["allowed"]:
            score = (w_cost * (5 - mat["cost"])) + (w_strength * mat["strength"]) + (w_durability * mat["durability"])
            if element_type == "load_bearing" and max_span > 5.0 and mat["name"] == "Steel Frame":
                score += 1.0 
            results.append({"material": mat["name"], "score": round(score, 2)})
            
    return sorted(results, key=lambda x: x["score"], reverse=True)[:3]

def generate_explainability(tradeoffs, max_span, ocr_text):
    prompt = f"""
    You are an expert structural engineer evaluating an AI-generated BIM model.
    Detected Rooms: {ocr_text}
    Max unsupported span: {max_span:.2f} meters.
    Material Tradeoffs: {json.dumps(tradeoffs)}
    Provide a brief, professional justification for these recommendations. Use bullet points.
    """
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": "You are a precise engineering AI."}, {"role": "user", "content": prompt}],
            temperature=0.3
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Groq Explainability failed: {str(e)}"

@app.post("/api/process")
async def process_blueprint(file: UploadFile = File(...)):
    image_bytes = await file.read()
    ocr_text = extract_text_from_image(image_bytes)
    
    # Stairs removed from unpacking
    walls, slab, windows, max_span = process_floorplan(image_bytes)
    
    tradeoffs = {
        "load_bearing": calculate_tradeoffs("load_bearing", max_span),
        "partition": calculate_tradeoffs("partition", max_span),
        "slab": calculate_tradeoffs("slab", max_span)
    }
    explainability = generate_explainability(tradeoffs, max_span, ocr_text)

    return {
        "geometry": {
            "walls": walls, 
            "slab": slab,
            "windows": windows
        }, 
        "max_span": max_span,
        "ocr_text": ocr_text,
        "tradeoffs": tradeoffs, 
        "explainability": explainability
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)