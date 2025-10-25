with subject_reference as (
    {{ get_single_reference(
        'stage__diagnosticreport', 
        'diagnostic_report_id', 
        'subject', 
        'subject_reference'
    ) }}
),
encounter_reference as (
    {{ get_single_reference(
        'stage__diagnosticreport', 
        'diagnostic_report_id', 
        'encounter', 
        'encounter_reference'
    ) }}
),
performer_references as (
    {{ get_multiple_references(
        'stage__diagnosticreport', 
        2, 
        'diagnostic_report_id', 
        'performer', 
        'performer', 
        'reference'
    ) }}
),
result_references as (
    {{ get_multiple_references(
        'stage__diagnosticreport', 
        29, 
        'diagnostic_report_id', 
        'result', 
        'result', 
        'reference'
    ) }}
),
all_references as (
    select * from subject_reference
    union all
    select * from encounter_reference
    union all
    select * from performer_references
    union all
    select * from result_references
)
select
        diagnostic_report_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
