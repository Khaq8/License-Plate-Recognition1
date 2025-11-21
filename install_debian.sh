#!/bin/bash
#
# FastALPR Automated Setup Script for Debian/Ubuntu
# This script installs all dependencies and sets up FastALPR from scratch
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "=================================================================="
echo "  FastALPR Setup Script for Debian/Ubuntu"
echo "=================================================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    echo "Run as regular user: ./install_debian.sh"
    exit 1
fi

# Check internet connection
print_status "Checking internet connection..."
if ping -c 1 google.com &> /dev/null; then
    print_success "Internet connection OK"
else
    print_error "No internet connection. Please check your network."
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update
if [ $? -eq 0 ]; then
    print_success "System packages updated"
else
    print_error "Failed to update packages"
    exit 1
fi

# Install Python and development tools
print_status "Installing Python and development tools..."
sudo apt install -y python3 python3-pip python3-venv python3-dev git
if [ $? -eq 0 ]; then
    print_success "Python and development tools installed"
else
    print_error "Failed to install Python"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version | awk '{print $2}')
print_status "Python version: $PYTHON_VERSION"

# Install OpenCV system dependencies
print_status "Installing OpenCV system dependencies (this may take a while)..."

# Try to install packages, handling newer Ubuntu versions
PACKAGES=(
    libgtk-3-dev
    pkg-config
    libavcodec-dev
    libavformat-dev
    libswscale-dev
    libv4l-dev
    libjpeg-dev
    libpng-dev
    libtiff-dev
    libtbb-dev
    v4l-utils
)

# Install core packages
sudo apt install -y "${PACKAGES[@]}" || true

# Install OpenGL libraries (package name varies by Ubuntu version)
if apt-cache show libgl1 &>/dev/null; then
    print_status "Installing libgl1 (newer Ubuntu)"
    sudo apt install -y libgl1
elif apt-cache show libgl1-mesa-glx &>/dev/null; then
    print_status "Installing libgl1-mesa-glx (older Ubuntu)"
    sudo apt install -y libgl1-mesa-glx
fi

# Install glib (package name varies by Ubuntu version)
if apt-cache show libglib2.0-0t64 &>/dev/null; then
    print_status "Installing libglib2.0-0t64 (newer Ubuntu)"
    sudo apt install -y libglib2.0-0t64
elif apt-cache show libglib2.0-0 &>/dev/null; then
    print_status "Installing libglib2.0-0 (older Ubuntu)"
    sudo apt install -y libglib2.0-0
fi

# Install optional packages (don't fail if not available)
for pkg in libgtk2.0-dev libxvidcore-dev libx264-dev gfortran openexr libdc1394-dev; do
    if apt-cache show $pkg &>/dev/null; then
        sudo apt install -y $pkg 2>/dev/null || true
    fi
done

if [ $? -eq 0 ]; then
    print_success "OpenCV dependencies installed"
else
    print_error "Failed to install OpenCV dependencies"
    exit 1
fi

# Check if already in fast-alpr directory
if [ ! -f "pyproject.toml" ]; then
    print_warning "Not in fast-alpr directory. Please clone the repository first:"
    echo "  git clone https://github.com/ankandrew/fast-alpr.git"
    echo "  cd fast-alpr"
    echo "  ./install_debian.sh"
    exit 1
fi

print_success "Found fast-alpr repository"

# Create virtual environment
print_status "Creating Python virtual environment..."
python3 -m venv venv
if [ $? -eq 0 ]; then
    print_success "Virtual environment created"
else
    print_error "Failed to create virtual environment"
    exit 1
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip setuptools wheel
print_success "pip upgraded"

# Install FastALPR with ONNX runtime
print_status "Installing FastALPR with ONNX runtime..."
pip install -e ".[onnx]"
if [ $? -eq 0 ]; then
    print_success "FastALPR installed"
else
    print_error "Failed to install FastALPR"
    exit 1
fi

# Remove opencv-python-headless
print_status "Removing opencv-python-headless (no GUI support)..."
pip uninstall opencv-python-headless -y 2>/dev/null || true
print_success "opencv-python-headless removed"

# Install full opencv-python
print_status "Installing opencv-python with GUI support..."
pip install opencv-python
if [ $? -eq 0 ]; then
    print_success "opencv-python installed"
else
    print_error "Failed to install opencv-python"
    exit 1
fi

# Add user to video group for webcam access
print_status "Adding user to video group for webcam access..."
sudo usermod -a -G video $USER
print_success "User added to video group"
print_warning "You may need to log out and log back in for group changes to take effect"

# Check for webcam
print_status "Checking for webcam devices..."
if ls /dev/video* 1> /dev/null 2>&1; then
    print_success "Webcam device(s) found:"
    ls -l /dev/video* | awk '{print "  " $NF}'
else
    print_warning "No webcam devices found. Please connect a webcam."
fi

# Verify installation
print_status "Verifying installation..."
echo ""
pip list | grep -E "(fast-alpr|opencv-python|onnxruntime)" | while read line; do
    echo "  $line"
done
echo ""

# Final summary
echo "=================================================================="
echo "  ✓ Installation Complete!"
echo "=================================================================="
echo ""
echo "Virtual environment created at: ./venv"
echo ""
echo "To use FastALPR, first activate the virtual environment:"
echo -e "  ${GREEN}source venv/bin/activate${NC}"
echo ""
echo "Then run one of these commands:"
echo -e "  ${BLUE}python3 test_alpr.py${NC}       # Test with static image"
echo -e "  ${BLUE}python3 test_webcam.py${NC}     # Test webcam access"
echo -e "  ${BLUE}python3 webcam_alpr.py${NC}     # Live license plate recognition"
echo ""
echo "Session files will be saved to: ./alpr_sessions/"
echo ""
echo "For more information, see:"
echo "  - SETUP_DEBIAN.md    (Detailed Debian/Ubuntu guide)"
echo "  - WEBCAM_USAGE.md    (Webcam usage guide)"
echo "  - README.md          (Project overview)"
echo ""
echo "=================================================================="
echo ""
print_warning "Note: If webcam doesn't work, you may need to:"
echo "  1. Log out and log back in (for video group permissions)"
echo "  2. Run: newgrp video"
echo ""
