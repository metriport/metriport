from enum import Enum

class Environment(Enum):
    DEV = "DEV"
    STAGING = "STAGING"
    PROD = "PROD"

    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value
