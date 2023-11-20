import os

def is_prod():
    # Determine if the current environment is production
    return os.getenv("IS_PROD", "False").lower() in ["true", "1", "yes"]
