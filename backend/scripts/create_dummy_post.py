import requests

API_URL = "http://localhost:8000"

payload = {
    "title": "Dummy Post from Python",
    "description": "Testing post creation from a python script",
    "preset_id": None,
    "visibility": "public"
}

response = requests.post(f"{API_URL}/api/posts", json=payload)
print(response.status_code, response.text)