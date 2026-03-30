# 🏗️ BIM AI Pipeline: Scan-to-BIM (Advanced Vision Edition)

A full-stack AI-powered application that transforms 2D floor plan images into interactive 3D Building Information Models (BIM). Utilizing OpenCV for geometric reconstruction and Large Language Models (via Groq) for OCR and engineering insights, this tool automates material estimation, structural classification, and model generation.

## 🌟 Key Features

* **Intelligent Floor Plan Parsing:** Uses OpenCV (Hough Line Transform, Morphological Operations) to extract orthogonal geometry from 2D blueprints.
* **Multimodal OCR Annotation:** Integrates `meta-llama/llama-4-scout-17b` via Groq to extract room names and dimensions from uploaded images.
* **Structural Classification:** Algorithmically categorizes walls as Load-Bearing (outer perimeter) or Partition (internal) using Shapely bounding boxes.
* **Interactive 2D/3D Visualization:** High-fidelity rendering of floor plans, windows, and slabs using `React Three Fiber` (3D) and interactive SVGs (2D).
* **Deterministic Material Optimization:** Calculates structural tradeoffs (Cost vs. Strength vs. Durability) based on detected structural spans and a built-in material database.
* **LLM-Powered Explainability:** Uses `llama-3.3-70b-versatile` to generate professional, plain-language engineering justifications for the material recommendations.

---

## 🏗️ System Architecture (The 5 Stages)

1. **Floor Plan Parsing:** OpenCV extracts wall lines; Groq Vision extracts textual annotations.
2. **Geometry Reconstruction:** Shapely determines spatial relationships and bounds to classify wall types and detect windows via gap analysis.
3. **3D Model Generation:** React Three Fiber extrudes the calculated 2D coordinates into a fully navigable 3D environment.
4. **Tradeoff Logic:** A deterministic weighted algorithm ranks materials (e.g., RCC, Steel Frame, AAC Blocks) for specific structural elements based on span length.
5. **Explainability:** Generative AI translates mathematical tradeoffs into readable engineering reports.

---

## 🛠️ Tech Stack

**Backend**
* Python 3.9+
* [FastAPI](https://fastapi.tiangolo.com/) - High-performance web framework
* [OpenCV](https://opencv.org/) & [NumPy](https://numpy.org/) - Computer Vision & array processing
* [Shapely](https://shapely.readthedocs.io/) - Geometric object manipulation
* [Groq Cloud API](https://groq.com/) - Lightning-fast LLM inference (Llama 4 Vision & Llama 3.3)

**Frontend**
* [React](https://reactjs.org/) (Vite recommended)
* [React Router](https://reactrouter.com/) - Navigation
* [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction) & Drei - 3D Canvas rendering
* [Lucide React](https://lucide.dev/) - Iconography
* [Axios](https://axios-http.com/) - API requests

---

## 🚀 Getting Started

### Prerequisites
* Python 3.9 or higher
* Node.js v16+ and npm/yarn
* A free [Groq API Key](https://console.groq.com/keys)

### 1. Backend Setup

Navigate to your backend directory and create a virtual environment:

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install required dependencies
pip install fastapi uvicorn opencv-python-headless numpy shapely python-dotenv groq python-multipart
