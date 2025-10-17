with mapping as (
    {{ get_medication_request_reason_ids('stage__medicationrequest', 4) }}
)
select
        cast(condition_id as {{ dbt.type_string() }} )                as condition_id
    ,   cast(medication_request_id as {{ dbt.type_string() }} )       as medication_request_id
from mapping
