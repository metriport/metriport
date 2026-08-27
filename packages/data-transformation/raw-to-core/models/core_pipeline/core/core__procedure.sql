{{ config(unique_key='m_patient_id') }}
{% set code_coding_max_index = 4 %}
{% set bodysite_coding_max_index = 1 %}
{% set bodysite_secondary_coding_max_index = 1 %}
{% set reasoncode_coding_max_index = 1 %}
{% set reasoncode_secondary_coding_max_index = 1 %}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('pro.id') }}                                              as procedure_id
    ,   {{ try_to_cast_string('right(pro.subject_reference, 36)') }}                    as patient_id
    ,   {{ try_to_cast_string('pro.status') }}                                          as status
    ,   coalesce(
            {{ try_to_cast_datetime('pro.performeddatetime') }},
            {{ try_to_cast_datetime('pro.performedperiod_start') }}
        )                                                                               as performed_date
    ,   {{ try_to_cast_datetime('pro.performedperiod_end') }}                           as end_date
    {#- CPT: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'pro',
            'code_coding',
            'http://www.ama-assn.org/go/cpt',
            code_coding_max_index,
            'code'
        )) }} as cpt_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'pro',
            'code_coding',
            'http://www.ama-assn.org/go/cpt',
            code_coding_max_index,
            'display'
        )) }} as cpt_display
    {#- SNOMED CT: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'pro',
            'code_coding',
            'http://snomed.info/sct',
            code_coding_max_index,
            'code'
        )) }} as snomed_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'pro',
            'code_coding',
            'http://snomed.info/sct',
            code_coding_max_index,
            'display'
        )) }} as snomed_display
    ,   {{ try_to_cast_string('pro.code_coding_0_code') }}                              as source_code_code
    ,   {{ try_to_cast_string('pro.code_coding_0_display') }}                           as source_code_display
    ,   {{ try_to_cast_string('pro.code_coding_0_system') }}                            as source_code_system
    {#- Body site SNOMED: Check nested bodysite_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'pro',
            'bodysite',
            'http://snomed.info/sct',
            bodysite_coding_max_index,
            bodysite_secondary_coding_max_index,
            'code'
        )) }} as bodysite_snomed_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'pro',
            'bodysite',
            'http://snomed.info/sct',
            bodysite_coding_max_index,
            bodysite_secondary_coding_max_index,
            'display'
        )) }} as bodysite_snomed_display
    {#- Reason SNOMED: Check nested reasoncode_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'pro',
            'reasoncode',
            'http://snomed.info/sct',
            reasoncode_coding_max_index,
            reasoncode_secondary_coding_max_index,
            'code'
        )) }} as reason_snomed_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'pro',
            'reasoncode',
            'http://snomed.info/sct',
            reasoncode_coding_max_index,
            reasoncode_secondary_coding_max_index,
            'display'
        )) }} as reason_snomed_display
    ,   {{ try_to_cast_string('pro.note_0_text') }}                                     as note_text
    ,   {{ try_to_cast_string('pro.meta_source') }}                                     as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'pro',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                           as data_source_ext
    ,   {{ try_to_cast_string('pro.meta_source') }}                                     as meta_source
    ,   pro.m_patient_id
    ,   pro.m_job_id
    ,   pro.m_created_at
    ,   pro.m_updated_at
    ,   pro.m_deleted_at
    ,   pro.raw_to_core_job_id
from {{ref('stage__procedure')}} pro
