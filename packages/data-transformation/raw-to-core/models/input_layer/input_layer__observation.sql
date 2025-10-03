select *
from {{ ref('connector__observation') }}
