{{ config(unique_key='m_patient_id') }}

select
        s.id as diagnostic_report_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__diagnosticreport')}} s
cross join lateral unnest(
    array[
        s.subject_reference,
        s.encounter_reference,
        s.performer_0_reference,
        s.performer_1_reference,
        s.performer_2_reference,
        s.result_00_reference,
        s.result_01_reference,
        s.result_02_reference,
        s.result_03_reference,
        s.result_04_reference,
        s.result_05_reference,
        s.result_06_reference,
        s.result_07_reference,
        s.result_08_reference,
        s.result_09_reference,
        s.result_10_reference,
        s.result_11_reference,
        s.result_12_reference,
        s.result_13_reference,
        s.result_14_reference,
        s.result_15_reference,
        s.result_16_reference,
        s.result_17_reference,
        s.result_18_reference,
        s.result_19_reference,
        s.result_20_reference,
        s.result_21_reference,
        s.result_22_reference,
        s.result_23_reference,
        s.result_24_reference,
        s.result_25_reference,
        s.result_26_reference,
        s.result_27_reference,
        s.result_28_reference,
        s.result_29_reference
    ],
    array[
        'subject',
        'encounter',
        'performer',
        'performer',
        'performer',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result',
        'result'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.subject_reference is not null or s.encounter_reference is not null or
        s.performer_0_reference is not null or s.performer_1_reference is not null or s.performer_2_reference is not null or
        s.result_00_reference is not null or s.result_01_reference is not null or s.result_02_reference is not null or
        s.result_03_reference is not null or s.result_04_reference is not null or s.result_05_reference is not null or
        s.result_06_reference is not null or s.result_07_reference is not null or s.result_08_reference is not null or
        s.result_09_reference is not null or s.result_10_reference is not null or s.result_11_reference is not null or
        s.result_12_reference is not null or s.result_13_reference is not null or s.result_14_reference is not null or
        s.result_15_reference is not null or s.result_16_reference is not null or s.result_17_reference is not null or
        s.result_18_reference is not null or s.result_19_reference is not null or s.result_20_reference is not null or
        s.result_21_reference is not null or s.result_22_reference is not null or s.result_23_reference is not null or
        s.result_24_reference is not null or s.result_25_reference is not null or s.result_26_reference is not null or
        s.result_27_reference is not null or s.result_28_reference is not null or s.result_29_reference is not null
    )
