# FastALPR Setup Guide - Debian/Ubuntu/Linux Mint

Complete setup instructions for Debian-based Linux systems from scratch.

## System Requirements

- Debian 10+, Ubuntu 20.04+, or Linux Mint 20+
- Internet connection
- Webcam (for live detection)

## Complete Installation from Scratch

### Step 1: Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Python 3.10+ and Development Tools

```bash
# Install Python 3.10 or higher
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Verify Python version (must be 3.10+)
python3 --version
```

**If Python version is less than 3.10, install Python 3.11:**

```bash
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
```

### Step 3: Install OpenCV System Dependencies

OpenCV needs GUI libraries for webcam display:

```bash
# Install OpenCV GUI support dependencies
# Note: Some packages have different names depending on Ubuntu/Debian version

# Core packages (should work on all versions)
sudo apt install -y \
    libgtk-3-dev \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libtbb-dev \
    v4l-utils

# For newer Ubuntu 24.04+ (use libgl1 instead of libgl1-mesa-glx)
sudo apt install -y libgl1 libglib2.0-0t64

# OR for older Ubuntu 22.04 and earlier (if above fails)
# sudo apt install -y libgl1-mesa-glx libglib2.0-0
```

### Step 4: Install Git (if not already installed)

```bash
sudo apt install -y git
```

### Step 5: Clone the Repository

```bash
cd ~
git clone https://github.com/ankandrew/fast-alpr.git
cd fast-alpr
```

### Step 6: Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate
```

**Important:** Always activate the virtual environment before running the scripts:
```bash
source venv/bin/activate
```

### Step 7: Upgrade pip

```bash
pip install --upgrade pip setuptools wheel
```

### Step 8: Install FastALPR with ONNX Runtime

```bash
pip install -e ".[onnx]"
```

**For NVIDIA GPU support (if you have CUDA installed):**
```bash
pip install -e ".[onnx-gpu]"
```

### Step 9: Replace OpenCV Headless with Full OpenCV

```bash
# Remove headless version (no GUI support)
pip uninstall opencv-python-headless -y

# Install full version with GUI support
pip install opencv-python
```

### Step 10: Verify Installation

```bash
# Check installed packages
pip list | grep -E "(fast-alpr|opencv|onnx)"
```

Expected output:
```
fast-alpr              0.3.0
opencv-python          4.12.0.88
onnxruntime            1.23.2
```

## Testing the Installation

### Test 1: Check Webcam Access

```bash
# List available video devices
v4l2-ctl --list-devices

# Test webcam with simple capture
python3 test_webcam.py
```

### Test 2: Static Image Recognition

```bash
python3 test_alpr.py
```

### Test 3: Live Webcam ALPR

```bash
python3 webcam_alpr.py
```

Press `q` to quit, `s` for screenshots.

## Complete One-Script Setup

Create and run this automated setup script:

```bash
#!/bin/bash

echo "================================================"
echo "FastALPR Debian/Ubuntu Setup Script"
echo "================================================"

# Exit on error
set -e

# Update system
echo "→ Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Python and development tools
echo "→ Installing Python and development tools..."
sudo apt install -y python3 python3-pip python3-venv python3-dev git

# Install OpenCV dependencies
echo "→ Installing OpenCV system dependencies..."
sudo apt install -y \
    libgtk-3-dev \
    libgtk2.0-dev \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    gfortran \
    openexr \
    libatlas-base-dev \
    libtbb2 \
    libtbb-dev \
    libdc1394-dev \
    v4l-utils

# Clone repository (if not in it already)
if [ ! -f "pyproject.toml" ]; then
    echo "→ Cloning repository..."
    git clone https://github.com/ankandrew/fast-alpr.git
    cd fast-alpr
fi

# Create virtual environment
echo "→ Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "→ Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install FastALPR
echo "→ Installing FastALPR..."
pip install -e ".[onnx]"

# Replace OpenCV
echo "→ Installing OpenCV with GUI support..."
pip uninstall opencv-python-headless -y
pip install opencv-python

echo ""
echo "================================================"
echo "✓ Installation Complete!"
echo "================================================"
echo ""
echo "To use FastALPR, activate the virtual environment:"
echo "  source venv/bin/activate"
echo ""
echo "Then run:"
echo "  python3 test_alpr.py       # Test static image"
echo "  python3 test_webcam.py     # Test webcam"
echo "  python3 webcam_alpr.py     # Live plate recognition"
echo ""
echo "================================================"
```

**Save this as `install_debian.sh` and run:**

```bash
chmod +x install_debian.sh
./install_debian.sh
```

## Quick Commands Summary

```bash
# System dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv python3-dev git
sudo apt install -y libgtk-3-dev pkg-config libavcodec-dev libavformat-dev libswscale-dev libv4l-dev libjpeg-dev libpng-dev libtiff-dev libtbb-dev v4l-utils

# For Ubuntu 24.04+ use:
sudo apt install -y libgl1 libglib2.0-0t64

# For Ubuntu 22.04 and older use:
# sudo apt install -y libgl1-mesa-glx libglib2.0-0

# Clone and setup
git clone https://github.com/ankandrew/fast-alpr.git
cd fast-alpr
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Install Python packages
pip install -e ".[onnx]"
pip uninstall opencv-python-headless -y
pip install opencv-python

# Test
python3 test_alpr.py
python3 test_webcam.py
python3 webcam_alpr.py
```

## Troubleshooting

### Issue: Package has no installation candidate (libtbb2, libatlas-base-dev)

Some packages have been renamed in newer Ubuntu/Debian versions.

**Solution 1 - Minimal OpenCV dependencies (fastest):**
```bash
sudo apt install -y \
    libgtk-3-dev \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libjpeg-dev \
    libpng-dev \
    libtbb-dev \
    v4l-utils \
    libgl1-mesa-glx \
    libglib2.0-0
```

**Solution 2 - Skip missing packages:**
```bash
# Install packages one by one, skip if any fail
for pkg in libgtk-3-dev libgtk2.0-dev pkg-config libavcodec-dev libavformat-dev libswscale-dev libv4l-dev libjpeg-dev libpng-dev libtbb-dev v4l-utils libgl1-mesa-glx libglib2.0-0; do
    sudo apt install -y $pkg 2>/dev/null || echo "Skipping $pkg"
done
```

**Solution 3 - Just install what's strictly needed:**
```bash
# Absolute minimum for webcam ALPR to work
sudo apt install -y python3 python3-pip python3-venv git libgl1-mesa-glx libglib2.0-0
```

### Issue: "Package 'libgl1-mesa-glx' has no installation candidate"

This package was replaced in Ubuntu 24.04+ and newer Debian versions.

**Solution:**
```bash
# For Ubuntu 24.04+ / Debian 13+
sudo apt install -y libgl1 libglib2.0-0t64

# For Ubuntu 22.04 and older
sudo apt install -y libgl1-mesa-glx libglib2.0-0
```

### Issue: "ImportError: libGL.so.1: cannot open shared object file"

```bash
# Try newer package first
sudo apt install -y libgl1

# If that doesn't work, try older name
sudo apt install -y libgl1-mesa-glx
```

### Issue: "ImportError: libgthread-2.0.so.0"

```bash
sudo apt install -y libglib2.0-0
```

### Issue: Webcam permission denied

```bash
# Add user to video group
sudo usermod -a -G video $USER

# Log out and log back in, or run:
newgrp video
```

### Issue: Webcam not detected

```bash
# List video devices
ls -l /dev/video*

# Check webcam with v4l2
v4l2-ctl --list-devices

# Test with cheese (webcam viewer)
sudo apt install cheese
cheese
```

### Issue: "Could not open webcam" in Python

Try different camera indices in `webcam_alpr.py`:
```python
webcam_alpr.run(camera_index=0)  # Try 0, 1, 2, etc.
```

### Issue: Display issues over SSH

If running over SSH, you need X11 forwarding:
```bash
# SSH with X11 forwarding
ssh -X user@hostname

# Or set display
export DISPLAY=:0
```

For headless servers, you can't use GUI. Use static image processing instead:
```python
python3 test_alpr.py  # This works without display
```

## Virtual Environment Commands

```bash
# Activate virtual environment (do this every time)
source venv/bin/activate

# Deactivate when done
deactivate

# Delete virtual environment (if you want to start fresh)
rm -rf venv
```

## Uninstall

```bash
# Remove virtual environment
rm -rf venv

# Remove repository
cd ..
rm -rf fast-alpr

# Remove system packages (optional)
sudo apt remove python3-opencv
```

## Performance Optimization

### For Better Performance (GPU)

If you have NVIDIA GPU with CUDA:

```bash
# Check if CUDA is available
nvidia-smi

# Install GPU version
pip install -e ".[onnx-gpu]"
```

### For Intel CPUs

```bash
pip install -e ".[onnx-openvino]"
```

## Additional Tips

1. **Always activate virtual environment before running:**
   ```bash
   source venv/bin/activate
   ```

2. **Check webcam before running ALPR:**
   ```bash
   python3 test_webcam.py
   ```

3. **Session files location:**
   ```bash
   ls -la alpr_sessions/
   ```

4. **View JSON output:**
   ```bash
   cat alpr_sessions/session_*.json | jq '.'
   ```

## System Service (Optional - Run on Boot)

Create a systemd service to run ALPR on boot:

```bash
sudo nano /etc/systemd/system/fast-alpr.service
```

Add:
```ini
[Unit]
Description=FastALPR Webcam Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/fast-alpr
ExecStart=/home/youruser/fast-alpr/venv/bin/python3 /home/youruser/fast-alpr/webcam_alpr.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable fast-alpr
sudo systemctl start fast-alpr
sudo systemctl status fast-alpr
```

## Summary

The key differences for Debian/Ubuntu:
1. Install system-level GTK libraries for OpenCV GUI support
2. Install v4l-utils for webcam access
3. Use `python3` instead of `python`
4. Use virtual environment (`venv`)
5. May need to add user to `video` group

That's it! Your friend should be ready to run FastALPR on Debian/Ubuntu! 🚀
