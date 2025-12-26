"""
Live Webcam License Plate Recognition System
This script captures license plates from a webcam in real-time and stores
the results in JSON files (one per session).
"""
import json
import os
from datetime import datetime
from pathlib import Path
from time import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
import requests
from app.routers import auth, plate, user, car, parking_lot, parking, admin
from app.cache import redis_cache
import cv2
from fast_alpr import ALPR

# Note: Database tables are now managed by Supabase (no SQLAlchemy migration needed)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup: Connect to Redis (required)
    print("Connecting to Redis...")
    try:
        await redis_cache.connect()
        print("Redis connection established")
    except Exception as e:
        print(f"FATAL: Could not connect to Redis: {e}")
        raise RuntimeError("Redis connection required. Please ensure Redis is running.")

    yield

    # Shutdown: Disconnect from Redis
    print("Disconnecting from Redis...")
    await redis_cache.disconnect()
    print("Redis disconnected")


app = FastAPI(
    title="License Plate Recognition System",
    description="Multi-lot parking management with ALPR",
    version="2.0.0",
    lifespan=lifespan
)

# Authentication & User routes
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(car.router)

# Plate detection routes
app.include_router(plate.router)

# Parking management routes
app.include_router(parking_lot.router)
app.include_router(parking.router)
app.include_router(admin.router)


# ============== Health Check Endpoints ==============

@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint for Docker/Kubernetes."""
    return {"status": "healthy", "service": "lpr-api"}


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """
    Readiness check - validates all dependencies are available.
    Used by Docker Compose and orchestrators to determine if the service is ready.
    """
    checks = {
        "api": "healthy",
        "redis": "unknown",
        "supabase": "unknown"
    }

    # Check Redis
    try:
        await redis_cache.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {str(e)}"

    # Check Supabase (basic connectivity)
    try:
        from app.supabase_client import get_supabase_admin
        supabase = get_supabase_admin()
        # Simple query to verify connection
        supabase.table("parking_lots").select("id").limit(1).execute()
        checks["supabase"] = "healthy"
    except Exception as e:
        checks["supabase"] = f"unhealthy: {str(e)}"

    all_healthy = all(v == "healthy" for v in checks.values())

    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks,
        "timestamp": datetime.now().isoformat()
    }


class WebcamALPR:
    """Webcam-based ALPR system with JSON logging."""

    def __init__(
        self,
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v1-global-model",
        output_dir="alpr_sessions",
        min_confidence=0.7,
        duplicate_threshold=5.0,
        api_url="http://127.0.0.1:8000/detections/",
    ):
        """
        Initialize the webcam ALPR system.

        Args:
            detector_model: Name of the detection model
            ocr_model: Name of the OCR model
            output_dir: Directory to store session JSON files
            min_confidence: Minimum confidence threshold for plate detection
            duplicate_threshold: Seconds to wait before recording same plate again
        """
        print("Initializing ALPR system...")
        self.alpr = ALPR(detector_model=detector_model, ocr_model=ocr_model)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.min_confidence = min_confidence
        self.duplicate_threshold = duplicate_threshold
        self.api_url = api_url

        # Create session file
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_file = self.output_dir / f"session_{self.session_id}.json"

        # Session data
        self.detected_plates = []
        self.last_seen = {}  # Track last time each plate was seen

        print(f"Session file: {self.session_file}")

    def is_duplicate(self, plate_text):
        """
        Check if this plate was recently detected.

        Args:
            plate_text: The plate text to check

        Returns:
            True if this is a duplicate within the threshold time
        """
        current_time = time()
        if plate_text in self.last_seen:
            time_diff = current_time - self.last_seen[plate_text]
            if time_diff < self.duplicate_threshold:
                return True
        return False

    def save_detection(self, plate_text, confidence, detection_confidence):
        """
        Save a plate detection to the session file.

        Args:
            plate_text: The detected plate text
            confidence: OCR confidence score
            detection_confidence: Detection confidence score
        """
        # Update last seen time
        self.last_seen[plate_text] = time()

        # Create detection record
        detection = {
            "timestamp": datetime.now().isoformat(),
            "plate": plate_text,
            "ocr_confidence": round(confidence, 4),
            "detection_confidence": round(detection_confidence, 4),
        }

        self.detected_plates.append(detection)

        # Save to file
        with open(self.session_file, "w") as f:
         json.dump(
                {
                    "session_id": self.session_id,
                    "session_start": self.detected_plates[0]["timestamp"],
                    "total_detections": len(self.detected_plates),
                    "detections": self.detected_plates,
                },
                f,
                indent=2,
            )

        # Send to FastAPI Database
        try:
            response = requests.post(
                self.api_url,
                params=dict(
                    session_id=self.session_id,
                    plate=plate_text,
                    ocr_conf=confidence,
                    det_conf=detection_confidence,
                ),
            )
            if response.status_code == 200:
                print(f"✓ DB Saved: {plate_text}")
            else:
                print("✗ Failed to save to DB", response.text)
        except Exception as e:
            print("✗ Database error:", e)

        print(f"✓ JSON Saved: {plate_text} (OCR: {confidence:.2%}, Det: {detection_confidence:.2%})")


    def run(self, camera_index=0):
        """
        Run the webcam ALPR system.

        Args:
            camera_index: Index of the camera to use (default: 0)
        """
        # Open webcam
        cap = cv2.VideoCapture(camera_index)

        if not cap.isOpened():
            print("Error: Could not open webcam.")
            return

        # Get camera properties
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))

        print(f"\nWebcam opened: {width}x{height} @ {fps}fps")
        print("=" * 60)
        print("INSTRUCTIONS:")
        print("- Show license plates to the camera")
        print("- Press 'q' to quit and end session")
        print("- Press 's' to take a screenshot")
        print("=" * 60)

        frame_count = 0
        process_every_n_frames = 5  # Process every 5th frame for performance

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Error: Could not read frame from webcam.")
                    break

                frame_count += 1
                display_frame = frame.copy()

                # Process frame for plate detection
                if frame_count % process_every_n_frames == 0:
                    try:
                        results = self.alpr.predict(frame)

                        for result in results:
                            detection_conf = result.detection.confidence
                            ocr_result = result.ocr

                            if ocr_result and detection_conf >= self.min_confidence:
                                plate_text = ocr_result.text
                                ocr_conf = ocr_result.confidence

                                # Check if this is a duplicate
                                if not self.is_duplicate(plate_text):
                                    self.save_detection(plate_text, ocr_conf, detection_conf)

                    except Exception as e:
                        print(f"Error during detection: {e}")

                # Draw predictions on display frame
                try:
                    display_frame = self.alpr.draw_predictions(display_frame)
                except:
                    pass

                # Add session info overlay
                cv2.putText(
                    display_frame,
                    f"Session: {self.session_id}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    display_frame,
                    f"Detections: {len(self.detected_plates)}",
                    (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    display_frame,
                    "Press 'q' to quit | 's' to screenshot",
                    (10, height - 20),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    1,
                )

                # Display the frame
                cv2.imshow("FastALPR - Live Webcam", display_frame)

                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    print("\nQuitting session...")
                    break
                elif key == ord("s"):
                    screenshot_path = self.output_dir / f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    cv2.imwrite(str(screenshot_path), display_frame)
                    print(f"Screenshot saved: {screenshot_path}")

        finally:
            # Cleanup
            cap.release()
            cv2.destroyAllWindows()

            # Print session summary
            print("\n" + "=" * 60)
            print("SESSION SUMMARY")
            print("=" * 60)
            print(f"Session ID: {self.session_id}")
            print(f"Total detections: {len(self.detected_plates)}")
            print(f"Session file: {self.session_file}")

            if self.detected_plates:
                print("\nDetected plates:")
                unique_plates = {}
                for detection in self.detected_plates:
                    plate = detection["plate"]
                    if plate not in unique_plates:
                        unique_plates[plate] = 0
                    unique_plates[plate] += 1

                for plate, count in unique_plates.items():
                    print(f"  - {plate}: {count} time(s)")

            print("=" * 60)


def main():
    """Main entry point."""
    print("=" * 60)
    print("FastALPR - Live Webcam License Plate Recognition")
    print("=" * 60)

    # Initialize and run webcam ALPR
    webcam_alpr = WebcamALPR(
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v1-global-model",
        output_dir="alpr_sessions",
        min_confidence=0.7,  # Minimum detection confidence
        duplicate_threshold=5.0,  # Don't record same plate within 5 seconds
    )

    webcam_alpr.run(camera_index=0)


if __name__ == "__main__":
    main()
