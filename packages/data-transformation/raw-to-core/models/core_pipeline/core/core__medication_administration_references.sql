with medication_reference as (
    {{ get_single_reference(
        'stage__medicationadministration', 
        'medication_administration_id', 
        'medication_reference', 
        'medicationreference_reference'
    ) }}
),
subject_reference as (
    {{ get_single_reference(
        'stage__medicationadministration', 
        'medication_administration_id', 
        'subject', 
        'subject_reference'
    ) }}
),
performer_references as (
    {{ get_multiple_references(
        'stage__medicationadministration', 
        2, 
        'medication_administration_id', 
        'performer.actor', 
        'performer', 
        'actor_reference'
    ) }}
),
all_references as (
    select * from medication_reference
    union all
    select * from subject_reference
    union all
    select * from performer_references
)
select
        medication_administration_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
