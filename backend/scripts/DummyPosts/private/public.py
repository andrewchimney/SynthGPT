import requests

API_URL = "http://localhost:8000"

# Test 1: Create a private post
print("Creating private post...")
private_payload = {
    "title": "This should NOT appear in the browse feed!",
    "description": "This is a private post that should not be visible in the public feed.",
    "preset_id": None,
    "visibility": "private"
}

response = requests.post(f"{API_URL}/api/posts", json=private_payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}\n")

# Test 2: Create a PUBLIC post
print("Creating public post...")
public_payload = {
    "title": "This SHOULD Show",
    "description": "Public post - visible on browse",
    "preset_id": None,
    "visibility": "public"  # ← Key: public visibility
}

resp = requests.post(f"{API_URL}/api/posts", json=public_payload)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}\n")