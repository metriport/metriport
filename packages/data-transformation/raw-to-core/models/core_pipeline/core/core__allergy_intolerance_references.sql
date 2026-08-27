{{ config(unique_key='m_patient_id') }}

select
        s.id as allergy_intolerance_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__allergyintolerance')}} s
cross join lateral unnest(
    array[
        s.patient_reference,
        s.encounter_reference,
        s.recorder_reference,
        s.asserter_reference
    ],
    array[
        'patient',
        'encounter',
        'recorder',
        'asserter'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.patient_reference is not null or s.encounter_reference is not null or s.recorder_reference is not null or s.asserter_reference is not null
    )
