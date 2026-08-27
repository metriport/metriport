{{ config(unique_key='m_patient_id') }}
{% set code_coding_max_index = 4 %}
{% set category_coding_max_index = 1 %}
{% set category_secondary_coding_max_index = 1 %}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('d.id') }}                                                             as diagnostic_report_id
    ,   {{ try_to_cast_string('right(d.subject_reference, 36)') }}                                   as patient_id
    ,   {{ try_to_cast_string('d.status') }}                                                         as status
    ,   coalesce(
            {{ try_to_cast_datetime('d.effectivedatetime') }}, 
            {{ try_to_cast_datetime('d.effectiveperiod_start') }}
        )                                                                                            as effective_date
    ,   {{ try_to_cast_datetime('d.effectiveperiod_end') }}                                          as end_date
    {#- LOINC: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'd',
            'code_coding',
            'http://loinc.org',
            code_coding_max_index,
            'code'
        )) }} as loinc_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'd',
            'code_coding',
            'http://loinc.org',
            code_coding_max_index,
            'display'
        )) }} as loinc_display
    ,   {{ try_to_cast_string('d.code_coding_0_code') }}                                             as source_code_code
    ,   {{ try_to_cast_string('d.code_coding_0_display') }}                                          as source_code_display
    ,   {{ try_to_cast_string('d.code_coding_0_system') }}                                           as source_code_system
    {#- Category HL7: Check nested category_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'd',
            'category',
            'http://terminology.hl7.org/CodeSystem/v2-0074',
            category_coding_max_index,
            category_secondary_coding_max_index,
            'code'
        )) }} as category_hl7_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'd',
            'category',
            'http://terminology.hl7.org/CodeSystem/v2-0074',
            category_coding_max_index,
            category_secondary_coding_max_index,
            'display'
        )) }} as category_hl7_display
    ,   {{ try_to_cast_string('d.category_0_coding_0_code') }}                                       as source_category_code
    ,   {{ try_to_cast_string('d.category_0_coding_0_display') }}                                    as source_category_display
    ,   {{ try_to_cast_string('d.category_0_coding_0_system') }}                                     as source_category_system
    ,   {{ try_to_cast_string('d.meta_source') }}                                                    as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'd',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                        as data_source_ext
    ,   {{ try_to_cast_string('d.meta_source') }}                                                    as meta_source
    ,   d.m_patient_id
    ,   d.m_job_id
    ,   d.m_created_at
    ,   d.m_updated_at
    ,   d.m_deleted_at
    ,   d.raw_to_core_job_id
from {{ref('stage__diagnosticreport')}} d
