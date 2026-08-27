{{ config(unique_key='m_patient_id') }}
{% set clinicalstatus_coding_max_index = 1 %}
{% set code_coding_max_index = 4 %}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('a.id') }}                                                                  as allergy_intolerance_id
    ,   {{ try_to_cast_string('right(a.patient_reference, 36)') }}                                        as patient_id
    ,   coalesce(
            {{ try_to_cast_datetime('a.onsetdatetime') }}, 
            {{ try_to_cast_datetime('a.onsetperiod_start') }}
        )                                                                                                 as onset_date
    {#- Clinical Status HL7: Check clinicalstatus_coding indices 0-1 -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'a',
            'clinicalstatus_coding',
            'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            clinicalstatus_coding_max_index,
            'code'
        )) }} as clinical_status_hl7_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'a',
            'clinicalstatus_coding',
            'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            clinicalstatus_coding_max_index,
            'display'
        )) }} as clinical_status_hl7_display
    ,   {{ try_to_cast_string('a.clinicalstatus_coding_0_code') }}                                        as source_clinical_status_code
    ,   {{ try_to_cast_string('a.clinicalstatus_coding_0_display') }}                                     as source_clinical_status_display
    ,   {{ try_to_cast_string('a.clinicalstatus_coding_0_system') }}                                      as source_clinical_status_system
    {#- SNOMED CT: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'a',
            'code_coding',
            'http://snomed.info/sct',
            code_coding_max_index,
            'code'
        )) }} as snomed_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'a',
            'code_coding',
            'http://snomed.info/sct',
            code_coding_max_index,
            'display'
        )) }} as snomed_display
    ,   {{ try_to_cast_string('a.code_coding_0_code') }}                                                  as source_code_code
    ,   {{ try_to_cast_string('a.code_coding_0_display') }}                                               as source_code_display
    ,   {{ try_to_cast_string('a.code_coding_0_system') }}                                                as source_code_system
    ,   {{ try_to_cast_string('a.meta_source') }}                                                         as meta_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'a',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                             as data_source_ext
    ,   a.m_patient_id
    ,   a.m_job_id
    ,   a.m_created_at
    ,   a.m_updated_at
    ,   a.m_deleted_at
    ,   a.raw_to_core_job_id
from {{ref('stage__allergyintolerance')}} a
