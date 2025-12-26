import uvicorn
import os

if __name__ == "__main__":
    # Run the ASGI application using Uvicorn
    # This starts the API server that the Frontend needs to connect to.
    print("Starting Backend API Server...")
    print("Docs available at: http://127.0.0.1:8000/docs")
    uvicorn.run("app.webcam_alpr:app", host="0.0.0.0", port=8000, reload=True)
