from enum import Enum

class Environment(Enum):
    DEV = "development"
    STAGING = "staging"
    PROD = "production"

    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value
