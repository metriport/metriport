with diagnosis_conditions as (
   {{   get_encounter_diagnose_condition_references(29) }}
),
all_references as (
    select * from diagnosis_conditions
)
select
        encounter_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
