with results as (
   {{   get_diagnostic_report_result_references() }}
),
all_references as (
    selec * from results
)
select
    diagnostic_report_id,
    property,
    reference_id,
    reference_type
from all_references
