import google.generativeai as genai
import os

# Set your API key
# It's recommended to store your API key securely, e.g., in an environment variable
# For demonstration, you can replace os.getenv with your actual key, but avoid hardcoding in production
genai.configure(api_key=os.getenv("GEMINI_API_KEY")) 

# List all available models
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(f"Model Name: {m.name}")