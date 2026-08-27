{{ config(unique_key='m_patient_id') }}

with base_resource as (
    select
        a.id,
        a.reaction_0_substance_coding_0_code,
        a.reaction_0_substance_coding_0_display,
        a.reaction_0_substance_coding_0_system,
        a.reaction_0_onset,
        a.reaction_0_severity,
        (
            nullif(a.reaction_0_manifestation_0_coding_0_code, '') is not null
            or nullif(a.reaction_0_manifestation_1_coding_0_code, '') is not null
            or nullif(a.reaction_0_manifestation_2_coding_0_code, '') is not null
        ) as reaction_0_has_manifestation,
        a.reaction_1_substance_coding_0_code,
        a.reaction_1_substance_coding_0_display,
        a.reaction_1_substance_coding_0_system,
        a.reaction_1_onset,
        a.reaction_1_severity,
        (
            nullif(a.reaction_1_manifestation_0_coding_0_code, '') is not null
            or nullif(a.reaction_1_manifestation_1_coding_0_code, '') is not null
            or nullif(a.reaction_1_manifestation_2_coding_0_code, '') is not null
        ) as reaction_1_has_manifestation,
        a.reaction_2_substance_coding_0_code,
        a.reaction_2_substance_coding_0_display,
        a.reaction_2_substance_coding_0_system,
        a.reaction_2_onset,
        a.reaction_2_severity,
        (
            nullif(a.reaction_2_manifestation_0_coding_0_code, '') is not null
            or nullif(a.reaction_2_manifestation_1_coding_0_code, '') is not null
            or nullif(a.reaction_2_manifestation_2_coding_0_code, '') is not null
        ) as reaction_2_has_manifestation,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from {{ref('stage__allergyintolerance')}} a
),
reaction_0 as (
    select
        a.id as allergy_intolerance_id,
        0 as reaction_index,
        a.reaction_0_substance_coding_0_code as source_substance_code,
        a.reaction_0_substance_coding_0_display as source_substance_display,
        a.reaction_0_substance_coding_0_system as source_substance_system,
        a.reaction_0_onset as onset_datetime,
        a.reaction_0_severity as severity,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where (
        nullif(a.reaction_0_substance_coding_0_code, '') is not null
        or nullif(a.reaction_0_onset, '') is not null
        or nullif(a.reaction_0_severity, '') is not null
        or a.reaction_0_has_manifestation
    )
),
reaction_1 as (
    select
        a.id as allergy_intolerance_id,
        1 as reaction_index,
        a.reaction_1_substance_coding_0_code as source_substance_code,
        a.reaction_1_substance_coding_0_display as source_substance_display,
        a.reaction_1_substance_coding_0_system as source_substance_system,
        a.reaction_1_onset as onset_datetime,
        a.reaction_1_severity as severity,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where (
        nullif(a.reaction_1_substance_coding_0_code, '') is not null
        or nullif(a.reaction_1_onset, '') is not null
        or nullif(a.reaction_1_severity, '') is not null
        or a.reaction_1_has_manifestation
    )
),
reaction_2 as (
    select
        a.id as allergy_intolerance_id,
        2 as reaction_index,
        a.reaction_2_substance_coding_0_code as source_substance_code,
        a.reaction_2_substance_coding_0_display as source_substance_display,
        a.reaction_2_substance_coding_0_system as source_substance_system,
        a.reaction_2_onset as onset_datetime,
        a.reaction_2_severity as severity,
        a.m_patient_id,
        a.m_job_id,
        a.m_created_at,
        a.m_updated_at,
        a.m_deleted_at,
        a.raw_to_core_job_id
    from base_resource a
    where (
        nullif(a.reaction_2_substance_coding_0_code, '') is not null
        or nullif(a.reaction_2_onset, '') is not null
        or nullif(a.reaction_2_severity, '') is not null
        or a.reaction_2_has_manifestation
    )
),
all_reactions as (
    select * from reaction_0
    union all
    select * from reaction_1
    union all
    select * from reaction_2
),
substance_codings as (
    {{ get_allergy_intolerance_reaction_substance_codings(
        ('http://snomed.info/sct',),
        2,
        0
    ) }}
),
substance_codings_with_rank as (
    select 
        *,
        row_number() over (partition by allergy_intolerance_id, reaction_index, system order by coding_index) as coding_rank
    from substance_codings
),
target_substance_codings as (
    select * 
    from substance_codings_with_rank
    where coding_rank = 1
)
select
        {{ try_to_cast_string(generate_uuid(base='r.allergy_intolerance_id', salt='r.reaction_index')) }}       as allergy_intolerance_reaction_id
    ,   {{ try_to_cast_string('r.allergy_intolerance_id') }}                                                    as allergy_intolerance_id
    ,   {{ try_to_cast_string('tc_snomed_ct.code') }}                                                           as snomed_code
    ,   {{ try_to_cast_string('tc_snomed_ct.display') }}                                                        as snomed_display
    ,   {{ try_to_cast_string('r.source_substance_code') }}                                                     as source_substance_code
    ,   {{ try_to_cast_string('r.source_substance_display') }}                                                  as source_substance_display
    ,   {{ try_to_cast_string('r.source_substance_system') }}                                                   as source_substance_system
    ,   {{ try_to_cast_datetime('r.onset_datetime') }}                                                          as onset_date
    ,   {{ try_to_cast_string('r.severity') }}                                                                  as severity
    ,   r.m_patient_id
    ,   r.m_job_id
    ,   r.m_created_at
    ,   r.m_updated_at
    ,   r.m_deleted_at
    ,   r.raw_to_core_job_id
from all_reactions r
left join target_substance_codings tc_snomed_ct
    on r.allergy_intolerance_id = tc_snomed_ct.allergy_intolerance_id 
        and r.reaction_index = tc_snomed_ct.reaction_index
        and tc_snomed_ct.system = 'http://snomed.info/sct'
