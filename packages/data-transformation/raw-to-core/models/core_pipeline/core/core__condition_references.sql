with subject_reference as (
   {{ get_single_reference(
        'stage__condition', 
        'condition_id', 
        'subject', 
        'subject_reference'
    ) }}
),
encounter_reference as (
   {{ get_single_reference(
        'stage__condition', 
        'condition_id', 
        'encounter', 
        'encounter_reference'
    ) }}
),
recorder_reference as (
   {{ get_single_reference(
        'stage__condition', 
        'condition_id', 
        'recorder', 
        'recorder_reference'
    ) }}
),
all_references as (
    select * from subject_reference
    union all
    select * from encounter_reference
    union all
    select * from recorder_reference
)
select
        condition_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
