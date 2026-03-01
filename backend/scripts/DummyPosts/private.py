import requests
import sys

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

# Test 2: Fetch browse feed and confirm private post is hidden
print("Fetching browse feed...")
feed_resp = requests.get(f"{API_URL}/api/posts")
print(f"Status: {feed_resp.status_code}")

if feed_resp.status_code != 200:
    print("❌ FAIL: Could not fetch browse feed")
    sys.exit(1)

data = feed_resp.json()

# Handle different response shapes
if isinstance(data, list):
    posts = data
elif isinstance(data, dict):
    posts = data.get("posts", [])
else:
    print(f"❌ FAIL: Unexpected response type: {type(data)}")
    print(data)
    sys.exit(1)

found = any(isinstance(p, dict) and p.get("title") == private_payload["title"] for p in posts)

if found:
    print("❌ FAIL: Private post appeared in browse feed")
    sys.exit(1)

print("✅ PASS: Private post is hidden from browse feed")