from enum import Enum

class DWH(Enum):
    SNOWFLAKE = "snowflake"
    ATHENA = "athena"

    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value
