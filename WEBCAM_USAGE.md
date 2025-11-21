# Webcam ALPR Usage Guide

## Overview
The webcam ALPR system allows you to detect and read license plates in real-time using your webcam. All detections are automatically saved to JSON files, with each session creating a new file.

## Quick Start

### Run the webcam ALPR:
```bash
python webcam_alpr.py
```

## Features

- **Real-time Detection**: Processes webcam feed and detects license plates
- **Automatic Saving**: Stores all detections in JSON files
- **Session Management**: Each run creates a new JSON file with timestamp
- **Duplicate Prevention**: Won't record the same plate twice within 5 seconds
- **Visual Feedback**: Shows bounding boxes and detected text on screen
- **Screenshots**: Save frames with the 's' key

## Controls

| Key | Action |
|-----|--------|
| `q` | Quit and end session |
| `s` | Take a screenshot |

## Configuration

You can customize the system by modifying these parameters in `webcam_alpr.py`:

```python
webcam_alpr = WebcamALPR(
    detector_model="yolo-v9-t-384-license-plate-end2end",
    ocr_model="cct-xs-v1-global-model",
    output_dir="alpr_sessions",           # Where to save JSON files
    min_confidence=0.7,                   # Minimum detection confidence (0-1)
    duplicate_threshold=5.0,              # Seconds before recording same plate again
)
```

### Parameters:
- **output_dir**: Directory where session JSON files are saved
- **min_confidence**: Minimum confidence score to accept a detection (0.0 - 1.0)
- **duplicate_threshold**: Time in seconds to prevent duplicate recordings
- **camera_index**: Webcam index (0 for default camera, 1 for secondary, etc.)

## Output Format

Session files are saved in `alpr_sessions/` directory with format: `session_YYYYMMDD_HHMMSS.json`

### JSON Structure:
```json
{
  "session_id": "20250108_143025",
  "session_start": "2025-01-08T14:30:25.123456",
  "total_detections": 3,
  "detections": [
    {
      "timestamp": "2025-01-08T14:30:25.123456",
      "plate": "ABC1234",
      "ocr_confidence": 0.9823,
      "detection_confidence": 0.8765
    },
    {
      "timestamp": "2025-01-08T14:31:12.654321",
      "plate": "XYZ5678",
      "ocr_confidence": 0.9956,
      "detection_confidence": 0.9123
    }
  ]
}
```

## Tips for Best Results

1. **Lighting**: Ensure good lighting on the license plate
2. **Distance**: Hold the plate 1-3 feet from the camera
3. **Angle**: Try to keep the plate straight and facing the camera
4. **Speed**: Move slowly - the system processes every 5th frame
5. **Focus**: Make sure your webcam can focus on the plate clearly

## Troubleshooting

### Webcam not opening?
- Check if another application is using the webcam
- Try changing `camera_index` from 0 to 1 or 2
- Make sure you have webcam permissions enabled

### Low detection accuracy?
- Increase lighting on the plate
- Move closer to the camera
- Adjust `min_confidence` to a lower value (e.g., 0.5)

### Performance issues?
- Increase `process_every_n_frames` in the code (default: 5)
- Lower the webcam resolution
- Use a faster computer or GPU version of ONNX runtime

## Session Files Location

All session files are saved in the `alpr_sessions/` directory:
- `session_YYYYMMDD_HHMMSS.json` - Detection data
- `screenshot_YYYYMMDD_HHMMSS.png` - Screenshots (if taken)

## Example Session

```
Session ID: 20250108_143025
Total detections: 5
Session file: alpr_sessions/session_20250108_143025.json

Detected plates:
  - ABC1234: 2 time(s)
  - XYZ5678: 1 time(s)
  - DEF9012: 2 time(s)
```
