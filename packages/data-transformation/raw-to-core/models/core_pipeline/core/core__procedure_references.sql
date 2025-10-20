with reports as (
   {{   get_procedure_report_references(29) }}
),
all_references as (
    select * from reports
)
select
        procedure_id
    ,   property
    ,   reference_id
    ,   reference_type
from all_references
