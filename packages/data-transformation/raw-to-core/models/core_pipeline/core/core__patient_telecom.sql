{{ config(unique_key='m_patient_id') }}

select
    {{ try_to_cast_string('pt.patient_id') }} as patient_id,
    {{ try_to_cast_string('pt.system') }} as system,
    {{ try_to_cast_string('pt.value') }} as value,
    row_number() over (partition by pt.patient_id order by pt.anchor_index) as telecom_rank,
    {{ get_inline_demographic_source(4) }} as data_source_ext,
    pt.m_patient_id,
    pt.m_job_id,
    pt.m_created_at,
    pt.m_updated_at,
    pt.m_deleted_at,
    pt.raw_to_core_job_id
from {{ ref("stage__patient_telecom") }} pt
