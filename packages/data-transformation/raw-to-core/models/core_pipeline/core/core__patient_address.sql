{{ config(unique_key='m_patient_id') }}

with base as (
    select
        {{ try_to_cast_string('pa.patient_id') }} as patient_id,
        {{ try_to_cast_string('pa.line_0') }} as line_0,
        {{ try_to_cast_string('pa.line_1') }} as line_1,
        {{ try_to_cast_string('pa.line_2') }} as line_2,
        {{ try_to_cast_string('pa.line_3') }} as line_3,
        {{ try_to_cast_string('pa.line_4') }} as line_4,
        {{ try_to_cast_string('pa.city') }} as city,
        {{ try_to_cast_string('pa.district') }} as district,
        {{ try_to_cast_string('pa.state') }} as state,
        {{ try_to_cast_string('pa.postalcode') }} as zip_code,
        {{ try_to_cast_string('pa.country') }} as country,
        row_number() over (partition by pa.patient_id order by pa.anchor_index) as address_rank,
        {{ get_inline_demographic_source(4) }} as data_source_ext,
        pa.m_patient_id,
        pa.m_job_id,
        pa.m_created_at,
        pa.m_updated_at,
        pa.m_deleted_at,
        pa.raw_to_core_job_id
    from {{ ref("stage__patient_address") }} pa
)
select
    patient_id,
    {{ try_to_cast_string("trim(coalesce(line_0, '') || coalesce(' ' || line_1, ''))") }} as address,
    city,
    district,
    state,
    zip_code,
    country,
    case 
        when line_0 is null and line_1 is null and line_2 is null and line_3 is null and line_4 is null 
        then null
        else 
        {% if target.name == 'postgres' %}
            array_remove(ARRAY[line_0, line_1, line_2, line_3, line_4], NULL)
        {% else %}
            array_construct_compact(line_0, line_1, line_2, line_3, line_4)
        {% endif %}
    end as lines,
    address_rank,
    data_source_ext,
    m_patient_id,
    m_job_id,
    m_created_at,
    m_updated_at,
    m_deleted_at,
    raw_to_core_job_id
from base
