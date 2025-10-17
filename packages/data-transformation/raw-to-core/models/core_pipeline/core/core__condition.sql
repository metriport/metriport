with target_code_codings as (
   {{   
        get_target_codings(
            get_condition_codings,
            'condition_id', 
            8, 
            none, 
            (
                'http://hl7.org/fhir/sid/icd-10-cm',
                'http://snomed.info/sct', 
                'http://hl7.org/fhir/sid/icd-9-cm'
            )
        ) 
    }}
),
target_category_codings as (
    {{ 
        get_target_codings(
            get_condition_category_codings, 
            'condition_id', 
            2, 
            1, 
            (
                'http://terminology.hl7.org/CodeSystem/condition-category',
            )
        ) 
    }}
),
target_clinical_status_codings as (
    {{ 
        get_target_codings(
            get_condition_clinical_status_codings, 
            'condition_id', 
            1, 
            none,
            (
                'http://terminology.hl7.org/CodeSystem/condition-clinical',
            )
        ) 
    }}
)
select
        cast(c.id as {{ dbt.type_string() }} )                                                              as condition_id
    ,   cast(right(c.subject_reference, 36) as {{ dbt.type_string() }} )                                    as patient_id
    ,   {{ try_to_cast_date('c.recordeddate') }}                                                            as recorded_date
    ,   coalesce(
            {{ try_to_cast_date('c.onsetdatetime') }}, 
            {{ try_to_cast_date('c.onsetperiod_start') }}
        )                                                                                                   as start_date
    ,   {{ try_to_cast_date('c.onsetperiod_end') }}                                                         as end_date
    ,   cast(
            coalesce(
                icd10.icd_10_cm,
                tc_icd_10_cm.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as icd_10_cm_code
    ,   cast(
            coalesce(
                icd10.long_description,
                tc_icd_10_cm.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as icd_10_cm_display
    ,   cast(
            coalesce(
                snomed.snomed_ct,
                tc_snomed_ct.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as snomed_code
    ,   cast(
            coalesce(
                snomed.description,
                tc_snomed_ct.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as snomed_display
    ,   cast(
            coalesce(
                icd9.icd_9_cm,
                tc_icd_9_cm.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as icd_9_cm_code
    ,   cast(
            coalesce(
                icd9.long_description,
                tc_icd_9_cm.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as icd_9_cm_display
    ,   cast(category_hl7.code as {{ dbt.type_string() }} )                                                 as category_hl7_code
    ,   cast(category_hl7.display as {{ dbt.type_string() }} )                                              as category_hl7_display
    ,   cast(clinical_status_hl7.code as {{ dbt.type_string() }} )                                          as clinical_status_hl7_code
    ,   cast(clinical_status_hl7.display as {{ dbt.type_string() }} )                                       as clinical_status_hl7_display
    ,   cast(
            coalesce(
                c.note_0_text,
                c.note_1_text,
                c.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note_text
    ,   cast(right(c.recorder_reference, 36) as {{ dbt.type_string() }} )                                   as recorder_practitioner_id
    ,   cast(c.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from {{ref('stage__condition')}} c
left join target_code_codings tc_icd_10_cm
    on c.id = tc_icd_10_cm.condition_id 
        and tc_icd_10_cm.system = 'http://hl7.org/fhir/sid/icd-10-cm'
left join target_code_codings tc_snomed_ct
    on c.id = tc_snomed_ct.condition_id 
        and tc_snomed_ct.system = 'http://snomed.info/sct'
left join target_code_codings tc_icd_9_cm
    on c.id = tc_icd_9_cm.condition_id 
        and tc_icd_9_cm.system = 'http://hl7.org/fhir/sid/icd-9-cm'
left join target_category_codings category_hl7
    on c.id = category_hl7.condition_id 
        and category_hl7.system = 'http://terminology.hl7.org/CodeSystem/condition-category'
left join target_clinical_status_codings clinical_status_hl7
    on c.id = clinical_status_hl7.condition_id 
        and clinical_status_hl7.system = 'http://terminology.hl7.org/CodeSystem/condition-clinical'
left join {{ref('terminology__icd_10_cm')}} icd10
    on tc_icd_10_cm.code = icd10.icd_10_cm
left join {{ref('terminology__snomed_ct')}} snomed
    on tc_snomed_ct.code = snomed.snomed_ct
left join {{ref('terminology__icd_9_cm')}} icd9
    on tc_icd_9_cm.code = icd9.icd_9_cm
