# ============================================================
# License Plate Recognition System - Dockerfile
# Multi-stage build for optimal image size
# ============================================================

# Stage 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install to user directory
COPY requirements.txt .
RUN pip install --no-cache-dir --user --no-warn-script-location -r requirements.txt

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies for OpenCV and general operation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash appuser

# Copy Python dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY ./app ./app
COPY ./run.py ./run.py
COPY ./alpr_sessions ./alpr_sessions

# Create directories for data persistence
RUN mkdir -p /app/data /app/models /app/alpr_sessions \
    && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Add local pip installs to PATH
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Disable OpenCV GUI (not needed in container)
    OPENCV_VIDEOIO_PRIORITY_MSMF=0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Run the FastAPI application
CMD ["python", "-m", "uvicorn", "app.webcam_alpr:app", "--host", "0.0.0.0", "--port", "8000"]
