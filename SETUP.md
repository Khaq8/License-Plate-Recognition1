# FastALPR Setup Instructions

Complete setup guide for installing and running the FastALPR system.

## Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- Webcam (for live detection)

## Installation Steps

### 1. Clone the Repository (if not already done)

```bash
git clone https://github.com/ankandrew/fast-alpr.git
cd fast-alpr
```

### 2. Install FastALPR with ONNX Runtime

**For CPU (Windows, Mac, Linux):**
```bash
pip install -e ".[onnx]"
```

**For NVIDIA GPU (if you have CUDA):**
```bash
pip install -e ".[onnx-gpu]"
```

**For Intel CPUs (OpenVINO):**
```bash
pip install -e ".[onnx-openvino]"
```

### 3. Replace OpenCV Headless with Full OpenCV

The webcam functionality requires GUI support, so replace the headless version:

```bash
pip uninstall opencv-python-headless -y
pip install opencv-python
```

### 4. Verify Installation

Check that everything is installed correctly:

```bash
python --version
pip list | grep -E "(fast-alpr|opencv|onnx)"
```

Expected output should show:
- `fast-alpr`
- `opencv-python` (NOT opencv-python-headless)
- `onnxruntime` (or onnxruntime-gpu)

## Testing the Installation

### Test 1: Static Image Recognition

Test with the included sample image:

```bash
python test_alpr.py
```

Expected output:
- License plate detected: `5AU5341`
- Confidence scores
- Output image saved to `assets/test_output.png`

### Test 2: Webcam Detection

First, test if your webcam works:

```bash
python test_webcam.py
```

Then run the full live ALPR system:

```bash
python webcam_alpr.py
```

Press `q` to quit, `s` to take screenshots.

## Quick Command Reference

### Windows (PowerShell/CMD)

```powershell
# Complete setup in one go
pip install -e ".[onnx]"
pip uninstall opencv-python-headless -y
pip install opencv-python

# Test installation
python test_alpr.py
python test_webcam.py
python webcam_alpr.py
```

### Linux/Mac (Bash)

```bash
# Complete setup in one go
pip install -e ".[onnx]"
pip uninstall opencv-python-headless -y
pip install opencv-python

# Test installation
python test_alpr.py
python test_webcam.py
python webcam_alpr.py
```

## File Structure After Setup

```
fast-alpr/
├── assets/
│   ├── test_image.png          # Sample test image
│   └── test_output.png         # Generated after running test_alpr.py
├── alpr_sessions/              # Generated when running webcam_alpr.py
│   └── session_*.json          # Session files (one per run)
├── test_alpr.py                # Test script for static images
├── test_webcam.py              # Test script for webcam
├── webcam_alpr.py              # Live webcam ALPR system
├── SETUP.md                    # This file
└── WEBCAM_USAGE.md             # Webcam usage guide
```

## Troubleshooting

### Issue: "opencv-python-headless has no GUI support"

**Solution:**
```bash
pip uninstall opencv-python-headless -y
pip install opencv-python
```

### Issue: "Could not open webcam"

**Solutions:**
1. Close other apps using the webcam (Zoom, Teams, Skype, etc.)
2. Try different camera index:
   - Edit `webcam_alpr.py` line 261
   - Change `camera_index=0` to `camera_index=1` or `camera_index=2`
3. Check Windows webcam permissions:
   - Settings → Privacy → Camera → Allow desktop apps

### Issue: "Module not found: fast_alpr"

**Solution:**
```bash
pip install -e ".[onnx]"
```

### Issue: "Slow performance"

**Solutions:**
1. Use GPU version (if you have NVIDIA GPU):
   ```bash
   pip install -e ".[onnx-gpu]"
   ```
2. Increase frame skip in `webcam_alpr.py`:
   - Change `process_every_n_frames = 5` to `process_every_n_frames = 10`

### Issue: "Low detection accuracy"

**Solutions:**
1. Improve lighting on the license plate
2. Hold plate closer to camera (1-3 feet)
3. Keep plate steady and straight
4. Lower confidence threshold in `webcam_alpr.py`:
   - Change `min_confidence=0.7` to `min_confidence=0.5`

## System Requirements

### Minimum:
- Python 3.10+
- 4GB RAM
- CPU: Any modern processor
- Webcam: 720p or higher recommended

### Recommended:
- Python 3.11+
- 8GB RAM
- CPU: Multi-core processor or NVIDIA GPU
- Webcam: 1080p with autofocus

## Python Version Check

Verify Python version (must be 3.10 or higher):

```bash
python --version
```

If Python version is too old, download from: https://www.python.org/downloads/

## Virtual Environment (Optional but Recommended)

To avoid conflicts with other Python projects:

### Windows:
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -e ".[onnx]"
pip uninstall opencv-python-headless -y
pip install opencv-python
```

### Linux/Mac:
```bash
python -m venv venv
source venv/bin/activate
pip install -e ".[onnx]"
pip uninstall opencv-python-headless -y
pip install opencv-python
```

## Next Steps

After successful setup:

1. **Test static images**: Run `python test_alpr.py`
2. **Test webcam**: Run `python test_webcam.py`
3. **Start live detection**: Run `python webcam_alpr.py`
4. **Check session files**: Look in `alpr_sessions/` folder for JSON output
5. **Read usage guide**: See `WEBCAM_USAGE.md` for detailed webcam instructions

## Getting Help

If you encounter issues:
1. Check this troubleshooting section
2. Review `WEBCAM_USAGE.md` for webcam-specific help
3. Check Python and pip versions
4. Ensure webcam is not in use by other applications

## Summary of Key Commands

```bash
# Installation
pip install -e ".[onnx]"
pip uninstall opencv-python-headless -y
pip install opencv-python

# Testing
python test_alpr.py                # Test with static image
python test_webcam.py              # Test webcam only
python webcam_alpr.py              # Full live ALPR system
```

That's it! You're ready to detect license plates! 🚀
