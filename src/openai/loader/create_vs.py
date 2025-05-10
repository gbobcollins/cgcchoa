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

def create_vector_store(vs_id):
    try:
        vector_store = openai.beta.vector_stores.create(
            name="cgcc_knowledge_base"
        )
        response = openai.beta.vector_stores.retrieve(vector_store_id=vs_id)
        print(f"Vector Store: {vector_store}")
    except Exception as e:
        print(f"Error creating vector store: {e}")

if __name__ == "__main__":
    if not api_key or not vector_store_id:
        print("Missing OPENAI_API_KEY or VECTOR_STORE_ID in .env file.")
    else:
        create_vector_store(vector_store_id)
