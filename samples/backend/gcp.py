from dotenv import load_dotenv
import os

load_dotenv()  # Load environment variables from .env file

## Mock GCP class 
class GCP:
    @staticmethod
    def get_secret(secret_name: str):
        # Return the secret from environment variables
        return os.getenv(secret_name)
