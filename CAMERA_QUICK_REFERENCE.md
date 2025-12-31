# 🎥 Camera Quick Reference

## One-Time Setup

```bash
# Set credentials (add to ~/.zshrc to make permanent)
export ALPR_ADMIN_EMAIL="admin@kuwaitparking.com"
export ALPR_ADMIN_PASSWORD="your_password"
```

## Common Commands

```bash
# List all available parking lots
python start_camera.py --list

# Start entry camera for Main Entrance A (Salmiya)
python start_camera.py main-a entry

# Start exit camera for Main Entrance A
python start_camera.py main-a exit

# Start entry camera for Underground P2 (Kuwait City)
python start_camera.py underground-p2 entry

# Start exit camera for Underground P2
python start_camera.py underground-p2 exit

# Start entry camera for VIP Surface Lot (Ahmadi)
python start_camera.py vip-surface entry

# Start exit camera for VIP Surface Lot
python start_camera.py vip-surface exit

# Use camera index 1 (if you have multiple cameras)
python start_camera.py main-a entry -c 1

# Auto-detect entry/exit mode
python start_camera.py main-a auto
```

## Running Multiple Cameras

Open separate terminals for each camera:

**Terminal 1:**
```bash
python start_camera.py main-a entry
```

**Terminal 2:**
```bash
python start_camera.py main-a exit -c 1
```

**Terminal 3:**
```bash
python start_camera.py underground-p2 entry -c 2
```

## Keyboard Controls

- **`q`** - Quit camera
- **`s`** - Take screenshot

## Adding Your Own Lots

Edit `camera_config.json`:

```json
{
  "lots": {
    "your-lot-name": {
      "lot_id": 4,
      "name": "Your Lot Display Name",
      "description": "Location description"
    }
  }
}
```

## Shell Aliases (Optional)

Add to `~/.zshrc`:

```bash
alias cam-main-entry="python start_camera.py main-a entry"
alias cam-main-exit="python start_camera.py main-a exit"
alias cam-p2-entry="python start_camera.py underground-p2 entry"
alias cam-p2-exit="python start_camera.py underground-p2 exit"
alias cam-vip-entry="python start_camera.py vip-surface entry"
alias cam-vip-exit="python start_camera.py vip-surface exit"
alias cam-list="python start_camera.py --list"
```

Then reload: `source ~/.zshrc`

Now you can simply run:
```bash
cam-main-entry
cam-p2-exit
cam-list
```
