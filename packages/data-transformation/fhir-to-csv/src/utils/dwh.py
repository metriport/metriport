from enum import Enum

class DWH(Enum):
    SNOWFLAKE = "snowflake"

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return self.value
