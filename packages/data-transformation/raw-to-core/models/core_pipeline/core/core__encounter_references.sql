{{ config(unique_key='m_patient_id') }}

select
        s.id as encounter_id
    ,   t.property
    ,   {{ get_reference_id('t.reference_value') }} as reference_id
    ,   {{ get_reference_type('t.reference_value') }} as reference_type
    ,   s.m_patient_id
    ,   s.m_job_id
    ,   s.m_created_at
    ,   s.m_updated_at
    ,   s.m_deleted_at
    ,   s.raw_to_core_job_id
from {{ref('stage__encounter')}} s
cross join lateral unnest(
    array[
        s.subject_reference,
        s.participant_0_individual_reference,
        s.participant_1_individual_reference,
        s.participant_2_individual_reference,
        s.location_0_location_reference,
        s.location_1_location_reference,
        s.location_2_location_reference,
        s.diagnosis_00_condition_reference,
        s.diagnosis_01_condition_reference,
        s.diagnosis_02_condition_reference,
        s.diagnosis_03_condition_reference,
        s.diagnosis_04_condition_reference,
        s.diagnosis_05_condition_reference,
        s.diagnosis_06_condition_reference,
        s.diagnosis_07_condition_reference,
        s.diagnosis_08_condition_reference,
        s.diagnosis_09_condition_reference,
        s.diagnosis_10_condition_reference,
        s.diagnosis_11_condition_reference,
        s.diagnosis_12_condition_reference,
        s.diagnosis_13_condition_reference,
        s.diagnosis_14_condition_reference,
        s.diagnosis_15_condition_reference,
        s.diagnosis_16_condition_reference,
        s.diagnosis_17_condition_reference,
        s.diagnosis_18_condition_reference,
        s.diagnosis_19_condition_reference,
        s.diagnosis_20_condition_reference,
        s.diagnosis_21_condition_reference,
        s.diagnosis_22_condition_reference,
        s.diagnosis_23_condition_reference,
        s.diagnosis_24_condition_reference,
        s.diagnosis_25_condition_reference,
        s.diagnosis_26_condition_reference,
        s.diagnosis_27_condition_reference,
        s.diagnosis_28_condition_reference,
        s.diagnosis_29_condition_reference
    ],
    array[
        'subject',
        'participant.individual',
        'participant.individual',
        'participant.individual',
        'location.location',
        'location.location',
        'location.location',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition',
        'diagnosis.condition'
    ]
) with ordinality as t(reference_value, property, reference_index)
where t.reference_value is not null
    and t.reference_value != ''
    and (
        s.subject_reference is not null or
        s.participant_0_individual_reference is not null or s.participant_1_individual_reference is not null or s.participant_2_individual_reference is not null or
        s.location_0_location_reference is not null or s.location_1_location_reference is not null or s.location_2_location_reference is not null or
        s.diagnosis_00_condition_reference is not null or s.diagnosis_01_condition_reference is not null or s.diagnosis_02_condition_reference is not null or
        s.diagnosis_03_condition_reference is not null or s.diagnosis_04_condition_reference is not null or s.diagnosis_05_condition_reference is not null or
        s.diagnosis_06_condition_reference is not null or s.diagnosis_07_condition_reference is not null or s.diagnosis_08_condition_reference is not null or
        s.diagnosis_09_condition_reference is not null or s.diagnosis_10_condition_reference is not null or s.diagnosis_11_condition_reference is not null or
        s.diagnosis_12_condition_reference is not null or s.diagnosis_13_condition_reference is not null or s.diagnosis_14_condition_reference is not null or
        s.diagnosis_15_condition_reference is not null or s.diagnosis_16_condition_reference is not null or s.diagnosis_17_condition_reference is not null or
        s.diagnosis_18_condition_reference is not null or s.diagnosis_19_condition_reference is not null or s.diagnosis_20_condition_reference is not null or
        s.diagnosis_21_condition_reference is not null or s.diagnosis_22_condition_reference is not null or s.diagnosis_23_condition_reference is not null or
        s.diagnosis_24_condition_reference is not null or s.diagnosis_25_condition_reference is not null or s.diagnosis_26_condition_reference is not null or
        s.diagnosis_27_condition_reference is not null or s.diagnosis_28_condition_reference is not null or s.diagnosis_29_condition_reference is not null
    )
