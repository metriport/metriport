with subject_reference as (
    {{ get_single_reference(
        'stage__observation', 
        'observation_id', 
        'subject', 
        'subject_reference'
    ) }}
),
encounter_reference as (
    {{ get_single_reference(
        'stage__observation', 
        'observation_id', 
        'encounter', 
        'encounter_reference'
    ) }}
),
performer_references as (
    {{ get_multiple_references(
        'stage__observation', 
        2, 
        'observation_id', 
        'performer', 
        'performer', 
        'reference'
    ) }}
),
all_references as (
    select * from subject_reference
    union all
    select * from encounter_reference
    union all
    select * from performer_references
)
select
        observation_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
