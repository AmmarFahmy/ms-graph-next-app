import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API endpoint
API_URL = "http://127.0.0.1:8000"


def test_health():
    """Test the health endpoint"""
    response = requests.get(f"{API_URL}/health")
    print(f"Health check status code: {response.status_code}")
    print(f"Health check response: {response.json()}")

    return response.status_code == 200


def test_query(query="What is this document about?", top_k=3):
    """Test the query endpoint"""
    payload = {
        "query": query,
        "top_k": top_k
    }

    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(
        f"{API_URL}/query", headers=headers, data=json.dumps(payload))

    print(f"Query status code: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("\nAnswer:")
        print(result["answer"])
        print("\nRetrieved Documents:")
        for i, doc in enumerate(result["documents"]):
            print(f"\nDocument {i+1}:")
            print(f"Title: {doc.get('title', 'No title')}")
            print(f"Page: {doc.get('page_number', 'N/A')}")
            print(f"Content: {doc.get('content', 'No content')[:100]}...")
    else:
        print(f"Error: {response.text}")

    return response.status_code == 200


if __name__ == "__main__":
    print("Testing API endpoints...")

    # Test health endpoint
    health_ok = test_health()

    if health_ok:
        print("\n✅ Health check passed!")

        # Test query endpoint
        print("\nTesting query endpoint...")
        query_ok = test_query()

        if query_ok:
            print("\n✅ Query test passed!")
        else:
            print("\n❌ Query test failed!")
    else:
        print("\n❌ Health check failed!")
