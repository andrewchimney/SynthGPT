# Docker Commands
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose
docker-compose -f docker-compose.prod.yml up --build
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod2.yml up -d
docker builder prune -af

# Python Commands:
source venv/bin/activate

# Curl Commands:
apt update && apt install curl -y
curl -X POST http://link \
    -H "Content-Type: application/json" \
    -d '{"data": "data"}'

