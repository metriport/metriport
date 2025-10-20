from enum import Enum

class Environment(Enum):
    DEV = "development"
    STAGING = "staging"
    PROD = "production"

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return self.value
