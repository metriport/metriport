with mapping as (
    {{ get_encounter_diagnoses_ids('stage__encounter', 29) }}
)
select
      cast(condition_id as {{ dbt.type_string() }} )     as condition_id
    , cast(encounter_id as {{ dbt.type_string() }} )     as encounter_id
from mapping
