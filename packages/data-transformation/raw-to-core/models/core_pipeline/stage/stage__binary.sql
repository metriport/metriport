select
    t.id,
    t.meta_lastupdated,
    t.meta_source,
    t.contenttype,
    t.data,
    t.patient_id,
    t.m_patient_id,
    t.m_job_id,
    t.m_created_at,
    t.m_updated_at,
    t.m_deleted_at,
    '{{ var('input_job_id') }}' as raw_to_core_job_id
from {{ source('raw', 'binary_active' if target.name == 'postgres' else 'binary') }} as t
inner join {{ source('raw', 'latest_metriport_incremental_job') }} j on t.m_patient_id = j.m_patient_id and t.m_job_id = j.id and j.m_created_at > '{{ var("lookback_timestamp") }}'::timestamp

