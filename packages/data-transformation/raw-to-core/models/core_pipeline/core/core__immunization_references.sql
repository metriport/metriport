with patient_reference as (
   {{ get_single_reference(
      'stage__immunization', 
      'immunization_id', 
      'patient', 
      'patient_reference'
   ) }}
),
encounter_reference as (
   {{ get_single_reference(
      'stage__immunization', 
      'immunization_id', 
      'encounter', 
      'encounter_reference'
   ) }}
),
performer_references as (
   {{ get_multiple_references(
      'stage__immunization', 
      2, 'immunization_id', 
      'performer.actor', 
      'performer', 
      'actor_reference'
   ) }}
),
all_references as (
    select * from patient_reference
    union all
    select * from encounter_reference
    union all
    select * from performer_references
)
select
        immunization_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
