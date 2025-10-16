with mapping as (
    {{ get_diagnostic_report_result_ids('stage__diagnosticreport', 29) }}
)
select
        cast(condition_id as {{ dbt.type_string() }} )     as observation_id
    ,   cast(encounter_id as {{ dbt.type_string() }} )     as diagnostic_report_id
from mapping
