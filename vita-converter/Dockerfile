FROM python:3.11-slim

# Minimal system libs for vita's native .so
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir vita scipy fastapi uvicorn python-multipart numpy

COPY converter.py .

CMD ["uvicorn", "converter:app", "--host", "0.0.0.0", "--port", "5000"]
