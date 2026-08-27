{{ config(unique_key='m_patient_id') }}
{% set code_coding_max_index = 9 %}
{% set category_coding_max_index = 1 %}
{% set category_secondary_coding_max_index = 1 %}
{% set clinicalstatus_coding_max_index = 1 %}
{% set extension_max_index = 9 %}

select
        {{ try_to_cast_string('c.id') }}                                                                  as condition_id
    ,   {{ try_to_cast_string('right(c.subject_reference, 36)') }}                                        as patient_id
    ,   {{ try_to_cast_datetime('c.recordeddate') }}                                                      as recorded_date
    ,   coalesce(
            {{ try_to_cast_datetime('c.onsetdatetime') }}, 
            {{ try_to_cast_datetime('c.onsetperiod_start') }}
        )                                                                                                 as onset_date
    ,   {{ try_to_cast_datetime('c.onsetperiod_end') }}                                                   as end_date
    {#- ICD-10-CM: Check each code_coding index 0-9 (10 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'http://hl7.org/fhir/sid/icd-10-cm',
            code_coding_max_index,
            'code'
        )) }} as icd_10_cm_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'http://hl7.org/fhir/sid/icd-10-cm',
            code_coding_max_index,
            'display'
        )) }} as icd_10_cm_display
    {#- SNOMED CT -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'http://snomed.info/sct',
            code_coding_max_index,
            'code'
        )) }} as snomed_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'http://snomed.info/sct',
            code_coding_max_index,
            'display'
        )) }} as snomed_display
    {#- ICD-9-CM -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'http://hl7.org/fhir/sid/icd-9-cm',
            code_coding_max_index,
            'code'
        )) }} as icd_9_cm_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'http://hl7.org/fhir/sid/icd-9-cm',
            code_coding_max_index,
            'display'
        )) }} as icd_9_cm_display
    {#- CCSR -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'https://hcup-us.ahrq.gov/toolssoftware/ccsr/ccs_refined.jsp',
            code_coding_max_index,
            'code'
        )) }} as ccsr_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'code_coding',
            'https://hcup-us.ahrq.gov/toolssoftware/ccsr/ccs_refined.jsp',
            code_coding_max_index,
            'display'
        )) }} as ccsr_display
    ,   {{ try_to_cast_string('c.code_coding_0_code') }}                                                  as source_code_code
    ,   {{ try_to_cast_string('c.code_coding_0_display') }}                                               as source_code_display
    ,   {{ try_to_cast_string('c.code_coding_0_system') }}                                                as source_code_system
    {#- Category HL7: Check nested category_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'c',
            'category',
            'http://terminology.hl7.org/CodeSystem/condition-category',
            category_coding_max_index,
            category_secondary_coding_max_index,
            'code'
        )) }} as category_hl7_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'c',
            'category',
            'http://terminology.hl7.org/CodeSystem/condition-category',
            category_coding_max_index,
            category_secondary_coding_max_index,
            'display'
        )) }} as category_hl7_display
    ,   {{ try_to_cast_string('c.category_0_coding_0_code') }}                                            as source_category_code
    ,   {{ try_to_cast_string('c.category_0_coding_0_display') }}                                         as source_category_display
    ,   {{ try_to_cast_string('c.category_0_coding_0_system') }}                                          as source_category_system
    {#- Clinical Status HL7 -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'clinicalstatus_coding',
            'http://terminology.hl7.org/CodeSystem/condition-clinical',
            clinicalstatus_coding_max_index,
            'code'
        )) }} as clinical_status_hl7_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'c',
            'clinicalstatus_coding',
            'http://terminology.hl7.org/CodeSystem/condition-clinical',
            clinicalstatus_coding_max_index,
            'display'
        )) }} as clinical_status_hl7_display
    ,   {{ try_to_cast_string('c.clinicalstatus_coding_0_code') }}                                        as source_clinical_status_code
    ,   {{ try_to_cast_string('c.clinicalstatus_coding_0_display') }}                                     as source_clinical_status_display
    ,   {{ try_to_cast_string('c.clinicalstatus_coding_0_system') }}                                      as source_clinical_status_system
    ,   {{ try_to_cast_string('c.note_0_text') }}                                                         as note_text
    {#- Chronicity: extension with condition-related URL and chronicity system -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'c',
            'http://hl7.org/fhir/StructureDefinition/condition-related',
            extension_max_index,
            'valuecoding_code',
            'https://public.metriport.com/fhir/StructureDefinition/condition-chronicity.json',
            'valuecoding_system'
        )) }} as chronicity_code
    {#- HCC: extension with hcc URL and cmshcc system -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'c',
            'https://public.metriport.com/fhir/StructureDefinition/condition-hcc.json',
            extension_max_index,
            'valuecodeableconcept_coding_0_code',
            'http://terminology.hl7.org/CodeSystem/cmshcc',
            'valuecodeableconcept_coding_0_system'
        )) }} as hcc_code
    ,   {{ try_to_cast_string('c.meta_source') }}                                                         as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'c',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                             as data_source_ext
    ,   {{ try_to_cast_string('c.meta_source') }}                                                         as meta_source
    ,   c.m_patient_id
    ,   c.m_job_id
    ,   c.m_created_at
    ,   c.m_updated_at
    ,   c.m_deleted_at
    ,   c.raw_to_core_job_id
from {{ref('stage__condition')}} c
