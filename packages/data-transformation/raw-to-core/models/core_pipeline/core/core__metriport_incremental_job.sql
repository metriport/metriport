{{ config(unique_key='m_patient_id') }}

select 
    *, 
    '{{ var('input_job_id') }}' as raw_to_core_job_id,
    CURRENT_TIMESTAMP as raw_to_core_created_at
from {{source('raw', 'latest_metriport_incremental_job')}} j where j.m_created_at > '{{ var("lookback_timestamp") }}'::timestamp
