with reports as (
   {{   get_procedure_report_references(30) }}
),
all_references as (
    selec * from reports
)
select
    diagnostic_report_id,
    property,
    reference_id,
    reference_type
from all_references
