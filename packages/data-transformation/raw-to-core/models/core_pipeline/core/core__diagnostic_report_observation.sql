with mapping as (
    {{ get_diagnostic_report_result_ids('stage__diagnosticreport', 29) }}
)
select
        cast(observation_id as {{ dbt.type_string() }} )            as observation_id
    ,   cast(diagnostic_report_id as {{ dbt.type_string() }} )      as diagnostic_report_id
from mapping
