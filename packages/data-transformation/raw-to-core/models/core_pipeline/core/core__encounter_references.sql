with subject_reference as (
   {{ get_single_reference(
        'stage__encounter', 
        'encounter_id', 
        'subject', 
        'subject_reference'
    ) }}
),
participant_references as (
   {{ get_multiple_references(
        'stage__encounter', 
        2, 
        'encounter_id', 
        'participant.individual', 
        'participant', 
        'individual_reference'
    ) }}
),
location_references as (
   {{ get_multiple_references(
        'stage__encounter', 
        2, 
        'encounter_id', 
        'location.location', 
        'location', 
        'location_reference'
    ) }}
),
diagnosis_conditions as (
   {{ get_multiple_references(
        'stage__encounter', 
        29, 
        'encounter_id', 
        'diagnosis.condition', 
        'diagnosis', 
        'condition_reference'
    ) }}
),
all_references as (
    select * from subject_reference
    union all
    select * from participant_references
    union all
    select * from location_references
    union all
    select * from diagnosis_conditions
)
select
        encounter_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
