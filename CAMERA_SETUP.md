# 🎥 Camera Management Guide

This guide shows you how to easily start ALPR cameras for different parking lots.

## Quick Start

### 1. Set Up Credentials (One-Time Setup)

Create a `.env.camera` file with your admin credentials:

```bash
cp .env.camera.example .env.camera
# Edit the file and add your credentials
```

Then load it in your terminal:

```bash
source .env.camera
export $(cat .env.camera | xargs)
```

**Or** add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Add this to ~/.zshrc
export ALPR_ADMIN_EMAIL="admin@kuwaitparking.com"
export ALPR_ADMIN_PASSWORD="your_password"
```

### 2. Start Cameras

**Basic usage:**

```bash
# Entry camera for Hamra
python start_camera.py hamra entry

# Exit camera for 360 Mall
python start_camera.py 360mall exit

# Auto-detect mode for Salmiya
python start_camera.py salmiya auto
```

**Advanced usage:**

```bash
# Use a different camera (index 1)
python start_camera.py hamra entry -c 1

# Custom confidence threshold
python start_camera.py 360mall exit --confidence 0.8

# List all available lots
python start_camera.py --list
```

## Available Parking Lots

| Name      | Lot ID | Description                          |
|-----------|--------|--------------------------------------|
| hamra     | 1      | Main parking facility in Hamra       |
| 360mall   | 2      | Shopping mall underground parking    |
| salmiya   | 3      | Beachfront parking area              |

*Edit `camera_config.json` to add more lots*

## Multi-Camera Setup

Run multiple cameras simultaneously by opening separate terminal windows:

**Terminal 1 - Hamra Entry:**
```bash
python start_camera.py hamra entry
```

**Terminal 2 - Hamra Exit:**
```bash
python start_camera.py hamra exit -c 1
```

**Terminal 3 - 360 Mall Entry:**
```bash
python start_camera.py 360mall entry -c 2
```

## Shell Aliases (Optional)

Add these to your `~/.zshrc` for even faster access:

```bash
# ALPR Camera Shortcuts
alias camera-hamra-entry="python start_camera.py hamra entry"
alias camera-hamra-exit="python start_camera.py hamra exit"
alias camera-360-entry="python start_camera.py 360mall entry"
alias camera-360-exit="python start_camera.py 360mall exit"
alias camera-list="python start_camera.py --list"
```

Then just run:
```bash
camera-hamra-entry
```

## Adding New Parking Lots

Edit `camera_config.json`:

```json
{
  "lots": {
    "your_lot_name": {
      "lot_id": 4,
      "name": "Your Parking Lot Name",
      "description": "Description of the location"
    }
  }
}
```

Then use:
```bash
python start_camera.py your_lot_name entry
```

## Camera Controls

- Press **`q`** to quit the camera
- Press **`s`** to take a screenshot
- Camera feed shows live detections with confidence scores

## Troubleshooting

**"Admin credentials required"**
- Set `ALPR_ADMIN_EMAIL` and `ALPR_ADMIN_PASSWORD` environment variables

**"Unknown parking lot"**
- Run `python start_camera.py --list` to see available lots
- Check `camera_config.json` for lot configurations

**"Could not open webcam"**
- Try a different camera index: `-c 1`, `-c 2`, etc.
- Check if another application is using the camera

**Camera feed is slow**
- Lower the confidence threshold: `--confidence 0.6`
- Increase duplicate threshold: `--duplicate-threshold 10.0`

## Session Files

Detection logs are saved to:
```
alpr_sessions/
  ├── hamra/
  │   └── session_20250101_120000.json
  ├── 360mall/
  │   └── session_20250101_120500.json
  └── salmiya/
      └── session_20250101_121000.json
```

Each session file contains:
- All plate detections
- Timestamps
- Confidence scores
- Entry/exit actions
- Lot information
