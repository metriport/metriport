{{ config(unique_key='m_patient_id') }}

select
        s.id as immunization_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__immunization')}} s
cross join lateral unnest(
    array[
        s.patient_reference,
        s.encounter_reference,
        s.location_reference,
        s.performer_0_actor_reference,
        s.performer_1_actor_reference,
        s.performer_2_actor_reference
    ],
    array[
        'patient',
        'encounter',
        'location',
        'performer.actor',
        'performer.actor',
        'performer.actor'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.patient_reference is not null or s.encounter_reference is not null or s.location_reference is not null or
        s.performer_0_actor_reference is not null or s.performer_1_actor_reference is not null or s.performer_2_actor_reference is not null
    )
