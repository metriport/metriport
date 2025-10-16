with mapping as (
    {{ get_medication_statement_reason_ids('stage__medicationstatement', 4) }}
)
select
        cast(condition_id as {{ dbt.type_string() }} )                as condition_id
    ,   cast(medication_statement_id as {{ dbt.type_string() }} )     as medication_statement_id
from mapping
