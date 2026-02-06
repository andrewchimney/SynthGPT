# Docker Commands
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose
docker-compose -f docker-compose.prod.yml up --build
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod2.yml up -d
docker builder prune -af

# Python Commands:
python -V
python3.12 -m venv .venv
source .venv/bin/activate
deactivate
pip install -r backend/requirements.txt 

# Curl Commands:
apt update && apt install curl -y
curl -X POST http://link \
    -H "Content-Type: application/json" \
    -d '{"data": "data"}'




curl -X POST "http://localhost:8000/api/retrieve" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "bright plucky lead",
    "k": 5
  }'