{{ config(unique_key='m_patient_id') }}

select
        s.id as medication_request_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__medicationrequest')}} s
cross join lateral unnest(
    array[
        s.medicationreference_reference,
        s.subject_reference,
        s.encounter_reference,
        s.requester_reference,
        s.reasonreference_0_reference,
        s.reasonreference_1_reference,
        s.reasonreference_2_reference,
        s.reasonreference_3_reference,
        s.reasonreference_4_reference,
        s.reasonreference_5_reference,
        s.reasonreference_6_reference,
        s.reasonreference_7_reference,
        s.reasonreference_8_reference,
        s.reasonreference_9_reference
    ],
    array[
        'medication_reference',
        'subject',
        'encounter',
        'requester',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference',
        'reason_reference'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.medicationreference_reference is not null or s.subject_reference is not null or s.encounter_reference is not null or s.requester_reference is not null or
        s.reasonreference_0_reference is not null or s.reasonreference_1_reference is not null or s.reasonreference_2_reference is not null or
        s.reasonreference_3_reference is not null or s.reasonreference_4_reference is not null or s.reasonreference_5_reference is not null or
        s.reasonreference_6_reference is not null or s.reasonreference_7_reference is not null or s.reasonreference_8_reference is not null or
        s.reasonreference_9_reference is not null
    )
