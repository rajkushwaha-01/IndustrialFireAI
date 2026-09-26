FROM python:3.11-slim

# Install system dependencies including curl for health checking
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source and model artifacts
COPY app/ ./app/
COPY model/ ./model/

# Set Python environment variables
ENV PYTHONUNBUFFERED=1
ENV MODEL_PATH=/app/model/fire_type_model.pkl
ENV PORT=8000

EXPOSE 8000

# Container healthcheck validates that ML model is loaded and inference-ready
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
