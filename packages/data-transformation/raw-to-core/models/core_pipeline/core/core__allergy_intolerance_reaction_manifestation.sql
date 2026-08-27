{{ config(unique_key='m_patient_id') }}

with base_resource as (
    select
        a.id,
        a.reaction_0_manifestation_0_coding_0_code,
        a.reaction_0_manifestation_0_coding_0_display,
        a.reaction_0_manifestation_0_coding_0_system,
        a.reaction_0_manifestation_1_coding_0_code,
        a.reaction_0_manifestation_1_coding_0_display,
        a.reaction_0_manifestation_1_coding_0_system,
        a.reaction_0_manifestation_2_coding_0_code,
        a.reaction_0_manifestation_2_coding_0_display,
        a.reaction_0_manifestation_2_coding_0_system,
        a.reaction_1_manifestation_0_coding_0_code,
        a.reaction_1_manifestation_0_coding_0_display,
        a.reaction_1_manifestation_0_coding_0_system,
        a.reaction_1_manifestation_1_coding_0_code,
        a.reaction_1_manifestation_1_coding_0_display,
        a.reaction_1_manifestation_1_coding_0_system,
        a.reaction_1_manifestation_2_coding_0_code,
        a.reaction_1_manifestation_2_coding_0_display,
        a.reaction_1_manifestation_2_coding_0_system,
        a.reaction_2_manifestation_0_coding_0_code,
        a.reaction_2_manifestation_0_coding_0_display,
        a.reaction_2_manifestation_0_coding_0_system,
        a.reaction_2_manifestation_1_coding_0_code,
        a.reaction_2_manifestation_1_coding_0_display,
        a.reaction_2_manifestation_1_coding_0_system,
        a.reaction_2_manifestation_2_coding_0_code,
        a.reaction_2_manifestation_2_coding_0_display,
        a.reaction_2_manifestation_2_coding_0_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from {{ref('stage__allergyintolerance')}} a
),
reaction_0_manifestation_0 as (
    select
        a.id as allergy_intolerance_id,
        0 as reaction_index,
        0 as manifestation_index,
        a.reaction_0_manifestation_0_coding_0_code as source_manifestation_code,
        a.reaction_0_manifestation_0_coding_0_display as source_manifestation_display,
        a.reaction_0_manifestation_0_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_0_manifestation_0_coding_0_code != '' and a.reaction_0_manifestation_0_coding_0_code is not null
),
reaction_0_manifestation_1 as (
    select
        a.id as allergy_intolerance_id,
        0 as reaction_index,
        1 as manifestation_index,
        a.reaction_0_manifestation_1_coding_0_code as source_manifestation_code,
        a.reaction_0_manifestation_1_coding_0_display as source_manifestation_display,
        a.reaction_0_manifestation_1_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_0_manifestation_1_coding_0_code != '' and a.reaction_0_manifestation_1_coding_0_code is not null
),
reaction_0_manifestation_2 as (
    select
        a.id as allergy_intolerance_id,
        0 as reaction_index,
        2 as manifestation_index,
        a.reaction_0_manifestation_2_coding_0_code as source_manifestation_code,
        a.reaction_0_manifestation_2_coding_0_display as source_manifestation_display,
        a.reaction_0_manifestation_2_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_0_manifestation_2_coding_0_code != '' and a.reaction_0_manifestation_2_coding_0_code is not null
),
reaction_1_manifestation_0 as (
    select
        a.id as allergy_intolerance_id,
        1 as reaction_index,
        0 as manifestation_index,
        a.reaction_1_manifestation_0_coding_0_code as source_manifestation_code,
        a.reaction_1_manifestation_0_coding_0_display as source_manifestation_display,
        a.reaction_1_manifestation_0_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_1_manifestation_0_coding_0_code != '' and a.reaction_1_manifestation_0_coding_0_code is not null
),
reaction_1_manifestation_1 as (
    select
        a.id as allergy_intolerance_id,
        1 as reaction_index,
        1 as manifestation_index,
        a.reaction_1_manifestation_1_coding_0_code as source_manifestation_code,
        a.reaction_1_manifestation_1_coding_0_display as source_manifestation_display,
        a.reaction_1_manifestation_1_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_1_manifestation_1_coding_0_code != '' and a.reaction_1_manifestation_1_coding_0_code is not null
),
reaction_1_manifestation_2 as (
    select
        a.id as allergy_intolerance_id,
        1 as reaction_index,
        2 as manifestation_index,
        a.reaction_1_manifestation_2_coding_0_code as source_manifestation_code,
        a.reaction_1_manifestation_2_coding_0_display as source_manifestation_display,
        a.reaction_1_manifestation_2_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_1_manifestation_2_coding_0_code != '' and a.reaction_1_manifestation_2_coding_0_code is not null
),
reaction_2_manifestation_0 as (
    select
        a.id as allergy_intolerance_id,
        2 as reaction_index,
        0 as manifestation_index,
        a.reaction_2_manifestation_0_coding_0_code as source_manifestation_code,
        a.reaction_2_manifestation_0_coding_0_display as source_manifestation_display,
        a.reaction_2_manifestation_0_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_2_manifestation_0_coding_0_code != '' and a.reaction_2_manifestation_0_coding_0_code is not null
),
reaction_2_manifestation_1 as (
    select
        a.id as allergy_intolerance_id,
        2 as reaction_index,
        1 as manifestation_index,
        a.reaction_2_manifestation_1_coding_0_code as source_manifestation_code,
        a.reaction_2_manifestation_1_coding_0_display as source_manifestation_display,
        a.reaction_2_manifestation_1_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_2_manifestation_1_coding_0_code != '' and a.reaction_2_manifestation_1_coding_0_code is not null
),
reaction_2_manifestation_2 as (
    select
        a.id as allergy_intolerance_id,
        2 as reaction_index,
        2 as manifestation_index,
        a.reaction_2_manifestation_2_coding_0_code as source_manifestation_code,
        a.reaction_2_manifestation_2_coding_0_display as source_manifestation_display,
        a.reaction_2_manifestation_2_coding_0_system as source_manifestation_system,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where a.reaction_2_manifestation_2_coding_0_code != '' and a.reaction_2_manifestation_2_coding_0_code is not null
),
all_manifestations as (
    select * from reaction_0_manifestation_0
    union all
    select * from reaction_0_manifestation_1
    union all
    select * from reaction_0_manifestation_2
    union all
    select * from reaction_1_manifestation_0
    union all
    select * from reaction_1_manifestation_1
    union all
    select * from reaction_1_manifestation_2
    union all
    select * from reaction_2_manifestation_0
    union all
    select * from reaction_2_manifestation_1
    union all
    select * from reaction_2_manifestation_2
),
reactions_with_ids as (
    select
        {{ generate_uuid(base='allergy_intolerance_id', salt='reaction_index') }} as allergy_intolerance_reaction_id,
        allergy_intolerance_id,
        reaction_index,
        m_patient_id,
        m_job_id,
        m_created_at,
        m_updated_at,
        m_deleted_at,
        raw_to_core_job_id
    from (
        select distinct
            allergy_intolerance_id,
            reaction_index,
            m_patient_id,
            m_job_id,
            m_created_at,
            m_updated_at,
            m_deleted_at,
            raw_to_core_job_id
        from all_manifestations
    ) as t
),
manifestation_codings as (
    {{ get_allergy_intolerance_reaction_manifestation_codings(
        ('http://snomed.info/sct',),
        2,
        2,
        0
    ) }}
),
manifestation_codings_with_rank as (
    select 
        *,
        row_number() over (partition by allergy_intolerance_id, reaction_index, manifestation_index, system order by coding_index) as coding_rank
    from manifestation_codings
),
target_manifestation_codings as (
    select * 
    from manifestation_codings_with_rank
    where coding_rank = 1
)
select
        {{ try_to_cast_string(generate_uuid(base='rwi.allergy_intolerance_reaction_id', salt='m.manifestation_index')) }}   as allergy_intolerance_reaction_manifestation_id
    ,   {{ try_to_cast_string('rwi.allergy_intolerance_reaction_id') }}                                                     as allergy_intolerance_reaction_id
    ,   {{ try_to_cast_string('tc_snomed_ct.code') }}                                                                       as snomed_code
    ,   {{ try_to_cast_string('tc_snomed_ct.display') }}                                                                    as snomed_display
    ,   {{ try_to_cast_string('m.source_manifestation_code') }}                                                             as source_manifestation_code
    ,   {{ try_to_cast_string('m.source_manifestation_display') }}                                                          as source_manifestation_display
    ,   {{ try_to_cast_string('m.source_manifestation_system') }}                                                           as source_manifestation_system
    ,   m.m_patient_id
    ,   m.m_job_id
    ,   m.m_created_at
    ,   m.m_updated_at
    ,   m.m_deleted_at
    ,   m.raw_to_core_job_id
from all_manifestations m
inner join reactions_with_ids rwi
    on m.allergy_intolerance_id = rwi.allergy_intolerance_id
        and m.reaction_index = rwi.reaction_index
left join target_manifestation_codings tc_snomed_ct
    on m.allergy_intolerance_id = tc_snomed_ct.allergy_intolerance_id 
        and m.reaction_index = tc_snomed_ct.reaction_index
        and m.manifestation_index = tc_snomed_ct.manifestation_index
        and tc_snomed_ct.system = 'http://snomed.info/sct'
