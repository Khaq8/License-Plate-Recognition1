"""
Test script for FastALPR - Automatic License Plate Recognition
This script demonstrates the ALPR system by detecting and reading license plates
from a test image.
"""
import cv2
from fast_alpr import ALPR

print("=" * 60)
print("FastALPR - Automatic License Plate Recognition Test")
print("=" * 60)

# Initialize the ALPR with default models
print("\nInitializing ALPR with default models...")
print("- Detector: yolo-v9-t-384-license-plate-end2end")
print("- OCR: cct-xs-v1-global-model")

alpr = ALPR(
    detector_model="yolo-v9-t-384-license-plate-end2end",
    ocr_model="cct-xs-v1-global-model",
)

# Run prediction on test image
print("\nRunning license plate detection and recognition...")
image_path = "assets/test_image.png"
alpr_results = alpr.predict(image_path)

# Display results
print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)
print(alpr_results)

# Create annotated image with predictions
print("\nCreating annotated image with detected plates...")
frame = cv2.imread(image_path)
annotated_frame = alpr.draw_predictions(frame)

# Save annotated image
output_path = "assets/test_output.png"
cv2.imwrite(output_path, annotated_frame)
print(f"Annotated image saved to: {output_path}")

print("\n" + "=" * 60)
print("Test completed successfully!")
print("=" * 60)
