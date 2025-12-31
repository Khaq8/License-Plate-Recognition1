#!/usr/bin/env python3
"""
Camera Management Script
Simplified interface for starting ALPR cameras with named parking lots.

Usage:
    python start_camera.py hamra entry          # Start entry camera for Hamra
    python start_camera.py 360mall exit         # Start exit camera for 360 Mall
    python start_camera.py salmiya entry -c 1   # Use camera index 1

Environment variables (optional, will prompt if not set):
    ALPR_ADMIN_EMAIL    - Admin email for authentication
    ALPR_ADMIN_PASSWORD - Admin password for authentication
"""

import sys
import os
import json
import argparse
from pathlib import Path
from getpass import getpass


def load_config():
    """Load camera configuration from camera_config.json"""
    config_file = Path(__file__).parent / "camera_config.json"

    if not config_file.exists():
        print(f"Error: Configuration file not found: {config_file}")
        print("Please create camera_config.json with parking lot definitions.")
        sys.exit(1)

    with open(config_file) as f:
        return json.load(f)


def get_credentials():
    """Get admin credentials from environment or prompt user"""
    email = os.environ.get("ALPR_ADMIN_EMAIL")
    password = os.environ.get("ALPR_ADMIN_PASSWORD")

    if not email:
        print("\nAdmin credentials required for camera operation.")
        print("Set ALPR_ADMIN_EMAIL and ALPR_ADMIN_PASSWORD environment variables to skip this prompt.\n")
        email = input("Admin Email: ").strip()

    if not password:
        password = getpass("Admin Password: ")

    return email, password


def list_lots(config):
    """Display available parking lots"""
    print("\n📍 Available Parking Lots:")
    print("=" * 60)

    for lot_key, lot_info in config["lots"].items():
        print(f"  {lot_key:15} → ID {lot_info['lot_id']}: {lot_info['name']}")
        print(f"  {' ' * 15}   {lot_info['description']}")
        print()

    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="🎥 ALPR Camera Manager - Start cameras with readable lot names",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python start_camera.py hamra entry           # Entry camera for Hamra
  python start_camera.py 360mall exit          # Exit camera for 360 Mall
  python start_camera.py salmiya auto -c 1     # Auto-detect mode, camera 1
  python start_camera.py --list                # Show available lots

Modes:
  entry  - All detections treated as entries (use at entrance)
  exit   - All detections treated as exits (use at exit gate)
  auto   - Auto-detect based on active sessions (default)

Tips:
  - Set ALPR_ADMIN_EMAIL and ALPR_ADMIN_PASSWORD to avoid typing credentials
  - Use different terminal windows to run multiple cameras simultaneously
  - Press 'q' in the camera window to stop
        """
    )

    parser.add_argument(
        "lot",
        nargs="?",
        help="Parking lot name (e.g., hamra, 360mall, salmiya)"
    )

    parser.add_argument(
        "mode",
        nargs="?",
        choices=["entry", "exit", "auto"],
        default="auto",
        help="Camera mode: entry, exit, or auto (default: auto)"
    )

    parser.add_argument(
        "-c", "--camera",
        type=int,
        default=0,
        help="Camera index to use (default: 0)"
    )

    parser.add_argument(
        "-l", "--list",
        action="store_true",
        help="List available parking lots and exit"
    )

    parser.add_argument(
        "--confidence",
        type=float,
        help="Minimum detection confidence (default: 0.7)"
    )

    parser.add_argument(
        "--duplicate-threshold",
        type=float,
        help="Seconds before recording same plate again (default: 5.0)"
    )

    args = parser.parse_args()

    # Load configuration
    config = load_config()

    # Handle --list flag
    if args.list:
        list_lots(config)
        return

    # Validate lot argument
    if not args.lot:
        print("Error: Parking lot name required\n")
        parser.print_help()
        print()
        list_lots(config)
        sys.exit(1)

    # Look up lot configuration
    lot_key = args.lot.lower()
    if lot_key not in config["lots"]:
        print(f"\n❌ Error: Unknown parking lot '{args.lot}'")
        list_lots(config)
        sys.exit(1)

    lot_config = config["lots"][lot_key]
    lot_id = lot_config["lot_id"]
    lot_name = lot_config["name"]

    # Get credentials
    email, password = get_credentials()

    # Get defaults
    defaults = config.get("defaults", {})
    api_url = defaults.get("api_url", "http://127.0.0.1:8000")
    confidence = args.confidence or defaults.get("confidence", 0.7)
    duplicate_threshold = args.duplicate_threshold or defaults.get("duplicate_threshold", 5.0)

    # Display configuration
    print("\n" + "=" * 60)
    print("🎥 ALPR Camera Starting")
    print("=" * 60)
    print(f"  Lot:       {lot_name} ({lot_key})")
    print(f"  Lot ID:    {lot_id}")
    print(f"  Mode:      {args.mode.upper()}")
    print(f"  Camera:    Index {args.camera}")
    print(f"  API:       {api_url}")
    print(f"  Admin:     {email}")
    print("=" * 60)
    print()

    # Import and run webcam ALPR
    try:
        from app.webcam_alpr import WebcamALPR

        webcam_alpr = WebcamALPR(
            detector_model="yolo-v9-t-384-license-plate-end2end",
            ocr_model="cct-xs-v1-global-model",
            output_dir=f"alpr_sessions/{lot_key}",
            min_confidence=confidence,
            duplicate_threshold=duplicate_threshold,
            api_base_url=api_url,
            lot_id=lot_id,
            mode=args.mode,
            admin_email=email,
            admin_password=password,
        )

        webcam_alpr.run(camera_index=args.camera)

    except KeyboardInterrupt:
        print("\n\n✓ Camera stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
