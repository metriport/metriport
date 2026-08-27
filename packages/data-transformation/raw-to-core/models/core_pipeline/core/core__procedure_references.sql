{{ config(unique_key='m_patient_id') }}

select
        s.id as procedure_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__procedure')}} s
cross join lateral unnest(
    array[
        s.subject_reference,
        s.encounter_reference,
        s.location_reference,
        s.performer_0_actor_reference,
        s.performer_1_actor_reference,
        s.performer_2_actor_reference,
        s.report_00_reference,
        s.report_01_reference,
        s.report_02_reference,
        s.report_03_reference,
        s.report_04_reference,
        s.report_05_reference,
        s.report_06_reference,
        s.report_07_reference,
        s.report_08_reference,
        s.report_09_reference,
        s.report_10_reference,
        s.report_11_reference,
        s.report_12_reference,
        s.report_13_reference,
        s.report_14_reference,
        s.report_15_reference,
        s.report_16_reference,
        s.report_17_reference,
        s.report_18_reference,
        s.report_19_reference,
        s.report_20_reference,
        s.report_21_reference,
        s.report_22_reference,
        s.report_23_reference,
        s.report_24_reference,
        s.report_25_reference,
        s.report_26_reference,
        s.report_27_reference,
        s.report_28_reference,
        s.report_29_reference
    ],
    array[
        'subject',
        'encounter',
        'location',
        'performer.actor',
        'performer.actor',
        'performer.actor',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report',
        'report'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.subject_reference is not null or s.encounter_reference is not null or s.location_reference is not null or
        s.performer_0_actor_reference is not null or s.performer_1_actor_reference is not null or s.performer_2_actor_reference is not null or
        s.report_00_reference is not null or s.report_01_reference is not null or s.report_02_reference is not null or
        s.report_03_reference is not null or s.report_04_reference is not null or s.report_05_reference is not null or
        s.report_06_reference is not null or s.report_07_reference is not null or s.report_08_reference is not null or
        s.report_09_reference is not null or s.report_10_reference is not null or s.report_11_reference is not null or
        s.report_12_reference is not null or s.report_13_reference is not null or s.report_14_reference is not null or
        s.report_15_reference is not null or s.report_16_reference is not null or s.report_17_reference is not null or
        s.report_18_reference is not null or s.report_19_reference is not null or s.report_20_reference is not null or
        s.report_21_reference is not null or s.report_22_reference is not null or s.report_23_reference is not null or
        s.report_24_reference is not null or s.report_25_reference is not null or s.report_26_reference is not null or
        s.report_27_reference is not null or s.report_28_reference is not null or s.report_29_reference is not null
    )
