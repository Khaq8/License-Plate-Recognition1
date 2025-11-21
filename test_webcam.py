"""
Quick test to verify webcam and OpenCV GUI support are working.
Press 'q' to quit.
"""
import cv2

print("Testing webcam connection...")
print("Press 'q' to quit")

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Could not open webcam.")
    print("\nTroubleshooting:")
    print("1. Make sure no other application is using the webcam")
    print("2. Check if your webcam is properly connected")
    print("3. Try changing camera index from 0 to 1")
    exit(1)

print("Webcam opened successfully!")
print("If you see a window with your webcam feed, everything is working.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("ERROR: Could not read frame")
        break

    # Add text to the frame
    cv2.putText(frame, "Webcam Test - Press 'q' to quit", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    cv2.imshow("Webcam Test", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Test completed successfully!")
