{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

with first_address as (
    select
        patient_id,
        address,
        city,
        state,
        zip_code
    from (
        select
            a.patient_id,
            a.address,
            a.city,
            a.state,
            a.zip_code,
            row_number() over (partition by a.patient_id order by a.address_rank) as rn
        from {{ ref('core__patient_address') }} a
    ) as t
    where rn = 1
),
first_email as (
    select
        patient_id,
        value as email
    from (
        select
            t.patient_id,
            t.value,
            row_number() over (partition by t.patient_id order by t.telecom_rank) as rn
        from {{ ref('core__patient_telecom') }} t
        where t.system = 'email'
    ) as t
    where rn = 1
),
first_phone as (
    select
        patient_id,
        value as phone
    from (
        select
            t.patient_id,
            t.value,
            row_number() over (partition by t.patient_id order by t.telecom_rank) as rn
        from {{ ref('core__patient_telecom') }} t
        where t.system = 'phone'
    ) as t
    where rn = 1
)
select 
        {{ try_to_cast_string('pat.id') }}                                              as patient_id
    ,   {{ try_to_cast_string('pat.name_0_given_0') }}                                  as first_name
    ,   {{ try_to_cast_string('pat.name_0_family') }}                                   as last_name
    ,   {{ try_to_cast_string('pat.gender') }}                                          as gender
    ,   {{ try_to_cast_date('pat.birthdate') }}                                         as birth_date
    ,   {{ try_to_cast_string('fa.address') }}                                          as address
    ,   {{ try_to_cast_string('fa.city') }}                                             as city
    ,   {{ try_to_cast_string('fa.state') }}                                            as state
    ,   {{ try_to_cast_string('fa.zip_code') }}                                         as zip_code
    ,   {{ try_to_cast_string('fe.email') }}                                            as email
    ,   {{ try_to_cast_string('fp.phone') }}                                            as phone
    ,   {{ try_to_cast_string('pat.meta_source') }}                                     as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'pat',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                           as data_source_ext
    ,   {{ try_to_cast_string('pat.meta_source') }}                                     as meta_source
    ,   pat.m_patient_id
    ,   pat.m_job_id
    ,   pat.m_created_at
    ,   pat.m_updated_at
    ,   pat.m_deleted_at
    ,   pat.raw_to_core_job_id
from {{ref('stage__patient')}} pat
left join first_address fa
    on pat.id = fa.patient_id
left join first_email fe
    on pat.id = fe.patient_id
left join first_phone fp
    on pat.id = fp.patient_id
