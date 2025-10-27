with medication_reference as (
    {{ get_single_reference(
        'stage__medicationstatement', 
        'medication_statement_id', 
        'medication_reference', 
        'medicationreference_reference'
    ) }}
),
subject_reference as (
    {{ get_single_reference(
        'stage__medicationstatement', 
        'medication_statement_id', 
        'subject', 
        'subject_reference'
    ) }}
),
all_references as (
    select * from medication_reference
    union all
    select * from subject_reference
)
select
        medication_statement_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
