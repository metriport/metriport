select
    t.anchor_index,
    t.extension_0_url,
    t.extension_0_valuecoding_code,
    t.extension_0_valuestring,
    t.extension_1_url,
    t.extension_1_valuecoding_code,
    t.extension_1_valuestring,
    t.extension_2_url,
    t.extension_2_valuecoding_code,
    t.extension_2_valuestring,
    t.extension_3_url,
    t.extension_3_valuecoding_code,
    t.extension_3_valuestring,
    t.extension_4_url,
    t.extension_4_valuecoding_code,
    t.extension_4_valuestring,
    t.patient_id,
    t.system,
    t.value,
    t.m_patient_id,
    t.m_job_id,
    t.m_created_at,
    t.m_updated_at,
    t.m_deleted_at,
    '{{ var('input_job_id') }}' as raw_to_core_job_id
from {{ source('raw', 'patient_telecom_active' if target.name == 'postgres' else 'patient_telecom') }} as t
inner join {{ source('raw', 'latest_metriport_incremental_job') }} j on t.m_patient_id = j.m_patient_id and t.m_job_id = j.id and j.m_created_at > '{{ var("lookback_timestamp") }}'::timestamp

