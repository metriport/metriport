with base_resource as (
    select
        id,
        subject_reference,
        recordeddate,
        onsetdatetime,
        onsetperiod_start,
        onsetperiod_end,
        code_coding_0_code,
        code_coding_0_display,
        code_coding_0_system,
        category_0_coding_0_code,
        category_0_coding_0_display,
        category_0_coding_0_system,
        clinicalstatus_coding_0_code,
        clinicalstatus_coding_0_display,
        clinicalstatus_coding_0_system,
        note_0_text,
        note_1_text,
        note_2_text,
        meta_source
    from {{ref('stage__condition')}}
),
target_code_codings as (
   {{   
        get_target_codings(
            get_condition_codings,
            'condition_id', 
            9, 
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
            1, 
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
        )                                                                                                   as onset_date
    ,   {{ try_to_cast_date('c.onsetperiod_end') }}                                                         as end_date
    ,   cast(tc_icd_10_cm.code as {{ dbt.type_string() }} )                                                 as icd_10_cm_code
    ,   cast(tc_icd_10_cm.display as {{ dbt.type_string() }} )                                              as icd_10_cm_display
    ,   cast(tc_snomed_ct.code as {{ dbt.type_string() }} )                                                 as snomed_code
    ,   cast(tc_snomed_ct.display as {{ dbt.type_string() }} )                                              as snomed_display
    ,   cast(tc_icd_9_cm.code as {{ dbt.type_string() }} )                                                  as icd_9_cm_code
    ,   cast(tc_icd_9_cm.display as {{ dbt.type_string() }} )                                               as icd_9_cm_display
    ,   cast(c.code_coding_0_code as {{ dbt.type_string() }} )                                              as source_code_code
    ,   cast(c.code_coding_0_display as {{ dbt.type_string() }} )                                           as source_code_display
    ,   cast(c.code_coding_0_system as {{ dbt.type_string() }} )                                            as source_code_system
    ,   cast(category_hl7.code as {{ dbt.type_string() }} )                                                 as category_hl7_code
    ,   cast(category_hl7.display as {{ dbt.type_string() }} )                                              as category_hl7_display
    ,   cast(c.category_0_coding_0_code as {{ dbt.type_string() }} )                                        as source_category_code
    ,   cast(c.category_0_coding_0_display as {{ dbt.type_string() }} )                                     as source_category_display
    ,   cast(c.category_0_coding_0_system as {{ dbt.type_string() }} )                                      as source_category_system
    ,   cast(clinical_status_hl7.code as {{ dbt.type_string() }} )                                          as clinical_status_hl7_code
    ,   cast(clinical_status_hl7.display as {{ dbt.type_string() }} )                                       as clinical_status_hl7_display
    ,   cast(c.clinicalstatus_coding_0_code as {{ dbt.type_string() }} )                                    as source_clinical_status_code
    ,   cast(c.clinicalstatus_coding_0_display as {{ dbt.type_string() }} )                                 as source_clinical_status_display
    ,   cast(c.clinicalstatus_coding_0_system as {{ dbt.type_string() }} )                                  as source_clinical_status_system
    ,   cast(
            coalesce(
                c.note_0_text,
                c.note_1_text,
                c.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note_text
    ,   cast(c.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from base_resource c
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
