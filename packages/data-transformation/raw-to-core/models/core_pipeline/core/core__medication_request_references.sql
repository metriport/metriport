with medication_reference as (
    {{ get_single_reference(
        'stage__medicationrequest', 
        'medication_request_id', 
        'medication_reference', 
        'medicationreference_reference'
    ) }}
),
subject_reference as (
    {{ get_single_reference(
        'stage__medicationrequest', 
        'medication_request_id', 
        'subject', 
        'subject_reference'
    ) }}
),
encounter_reference as (
    {{ get_single_reference(
        'stage__medicationrequest', 
        'medication_request_id', 
        'encounter', 
        'encounter_reference'
    ) }}
),
requester_reference as (
    {{ get_single_reference(
        'stage__medicationrequest', 
        'medication_request_id', 
        'requester', 
        'requester_reference'
    ) }}
),
reason_reference_references as (
    {{ get_multiple_references(
        'stage__medicationrequest', 
        9, 
        'medication_request_id', 
        'reason_reference', 
        'reasonreference', 
        'reference'
    ) }}
),
all_references as (
    select * from medication_reference
    union all
    select * from subject_reference
    union all
    select * from encounter_reference
    union all
    select * from requester_reference
    union all
    select * from reason_reference_references
)
select
        medication_request_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
