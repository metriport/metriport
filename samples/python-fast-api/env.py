import os

def is_prod():
    # Determine if the current environment is production
    return os.getenv("IS_PROD", "False").lower() in ["true", "1", "yes"]

def get_env_var(key, default=None):
    # Get an environment variable, with an optional default
    return os.getenv(key, default)
