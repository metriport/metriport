with reason_references as (
   {{   get_medication_request_reason_references(9) }}
),
all_references as (
    select * from reason_references
)
select
        medication_request_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
