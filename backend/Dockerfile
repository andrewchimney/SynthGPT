FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .


ENV HF_HOME=/root/.cache/huggingface

RUN python -c "import laion_clap; m=laion_clap.CLAP_Module(enable_fusion=False); m.load_ckpt(); print('CLAP cached')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]