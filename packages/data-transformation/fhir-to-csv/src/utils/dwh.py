from enum import Enum

class DWH(Enum):
    SNOWFLAKE = "snowflake"

    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value
