{{ config(unique_key='m_patient_id') }}

select
        s.id as coverage_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__coverage')}} s
cross join lateral unnest(
    array[
        s.beneficiary_reference,
        s.policyholder_reference,
        s.subscriber_reference,
        s.payor_0_reference,
        s.payor_1_reference,
        s.payor_2_reference
    ],
    array[
        'beneficiary',
        'policyHolder',
        'subscriber',
        'payor',
        'payor',
        'payor'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.beneficiary_reference is not null or s.policyholder_reference is not null or s.subscriber_reference is not null or
        s.payor_0_reference is not null or s.payor_1_reference is not null or s.payor_2_reference is not null
    )
