{{ config(unique_key='m_patient_id') }}

select
        s.id as medication_statement_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__medicationstatement')}} s
cross join lateral unnest(
    array[
        s.medicationreference_reference,
        s.subject_reference
    ],
    array[
        'medication_reference',
        'subject'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.medicationreference_reference is not null or s.subject_reference is not null
    )
