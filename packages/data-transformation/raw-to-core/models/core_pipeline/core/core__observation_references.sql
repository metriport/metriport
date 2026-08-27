{{ config(unique_key='m_patient_id') }}

select
        s.id as observation_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__observation')}} s
cross join lateral unnest(
    array[
        s.subject_reference,
        s.encounter_reference,
        s.performer_0_reference,
        s.performer_1_reference,
        s.performer_2_reference
    ],
    array[
        'subject',
        'encounter',
        'performer',
        'performer',
        'performer'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.subject_reference is not null or s.encounter_reference is not null or
        s.performer_0_reference is not null or s.performer_1_reference is not null or s.performer_2_reference is not null
    )
