import os
from dotenv import load_dotenv
import openai

# Load .env file
load_dotenv()

# Read API key and vector store ID
api_key = os.getenv("OPENAI_API_KEY")
vector_store_id = os.getenv("VECTOR_STORE_ID")

# Set API key
openai.api_key = api_key

def get_vector_store_status(vs_id):
    try:
        response = openai.beta.vector_stores.retrieve(vector_store_id=vs_id)
        print("Vector Store Status:")
        print(f"ID: {response.id}")
        print(f"Name: {response.name}")
        print(f"Status: {response.status}")
        print(f"Created at: {response.created_at}")
    except Exception as e:
        print(f"Error retrieving vector store: {e}")

if __name__ == "__main__":
    if not api_key or not vector_store_id:
        print("Missing OPENAI_API_KEY or VECTOR_STORE_ID in .env file.")
    else:
        get_vector_store_status(vector_store_id)
