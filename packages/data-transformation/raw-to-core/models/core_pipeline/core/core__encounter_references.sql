with diagnosis_conditions as (
   {{   get_encounter_diagnose_condition_references() }}
),
all_references as (
    selec * from diagnosis_conditions
)
select
    encounter_id,
    property,
    reference_id,
    reference_type
from all_references
