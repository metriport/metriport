with subject_reference as (
    {{ get_single_reference(
        'stage__procedure', 
        'procedure_id', 
        'subject', 
        'subject_reference'
    ) }}
),
encounter_reference as (
    {{ get_single_reference(
        'stage__procedure', 
        'procedure_id', 
        'encounter', 
        'encounter_reference'
    ) }}
),
location_reference as (
    {{ get_single_reference(
        'stage__procedure', 
        'procedure_id', 
        'location', 
        'location_reference'
    ) }}
),
performer_references as (
    {{ get_multiple_references(
        'stage__procedure', 
        2, 
        'procedure_id', 
        'performer.actor', 
        'performer', 
        'actor_reference'
    ) }}
),
report_references as (
    {{ get_multiple_references(
        'stage__procedure', 
        29, 
        'procedure_id', 
        'report', 
        'reportreference',  -- Should just be report
        'reference'
    ) }}
),
all_references as (
    select * from subject_reference
    union all
    select * from encounter_reference
    union all
    select * from location_reference
    union all
    select * from performer_references
    union all
    select * from report_references
)
select
        procedure_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
