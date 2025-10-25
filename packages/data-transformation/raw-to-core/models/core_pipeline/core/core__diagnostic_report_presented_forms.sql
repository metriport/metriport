with presented_forms as (
   {{   get_diagnostic_report_presented_forms(29) }}
)
select
        diagnostic_report_id
    ,   data
    ,   content_type
    ,   creation
    ,   hash
    ,   language
    ,   size
    ,   title
    ,   url
from presented_forms
