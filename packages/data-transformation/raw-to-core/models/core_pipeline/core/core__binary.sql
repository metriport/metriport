{{ config(unique_key='m_patient_id') }}

with base_resource as (
    select
        {{ try_to_cast_string('b.id') }} as id,
        {{ try_to_cast_string('b.contenttype') }} as contenttype,
        {{ try_to_cast_string('b.data') }} as data,
        {{ try_to_cast_string('b.meta_source') }} as meta_source,
        {{ try_to_cast_string('b.meta_lastupdated') }} as meta_lastupdated,
        {{ try_to_cast_string('b.patient_id') }} as patient_id,
        b.m_patient_id,
        b.m_job_id,
        b.m_created_at,
        b.m_updated_at,
        b.m_deleted_at,
        b.raw_to_core_job_id
    from {{ref('stage__binary')}} b
)
select
    bin.id                                                      as binary_id,
    bin.patient_id                                              as patient_id,
    bin.contenttype                                             as content_type,
    bin.data                                                    as data,
    bin.meta_source                                             as meta_source,
    bin.meta_lastupdated                                        as meta_last_updated,
    bin.m_patient_id,
    bin.m_job_id,
    bin.m_created_at,
    bin.m_updated_at,
    bin.m_deleted_at,
    bin.raw_to_core_job_id
from base_resource bin
