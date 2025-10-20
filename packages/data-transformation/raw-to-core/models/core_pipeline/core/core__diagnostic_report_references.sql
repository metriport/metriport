with results as (
   {{   get_diagnostic_report_result_references(29) }}
),
all_references as (
    select * from results
)
select
        diagnostic_report_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
