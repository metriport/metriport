{{ config(unique_key='m_patient_id') }}
{% set code_coding_max_index = 4 %}
{% set extension_max_index = 2 %}

select 
        {{ try_to_cast_string('m.id') }}                                                              as medication_id
    ,   {{ try_to_cast_string('m.status') }}                                                          as status
    {#- RxNorm: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'm',
            'code_coding',
            'http://www.nlm.nih.gov/research/umls/rxnorm',
            code_coding_max_index,
            'code'
        )) }} as rxnorm_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'm',
            'code_coding',
            'http://www.nlm.nih.gov/research/umls/rxnorm',
            code_coding_max_index,
            'display'
        )) }} as rxnorm_display
    {#- NDC: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'm',
            'code_coding',
            'http://hl7.org/fhir/sid/ndc',
            code_coding_max_index,
            'code'
        )) }} as ndc_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'm',
            'code_coding',
            'http://hl7.org/fhir/sid/ndc',
            code_coding_max_index,
            'display'
        )) }} as ndc_display
    ,   {{ try_to_cast_string('m.meta_source') }}                                                     as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'm',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                         as data_source_ext
    ,   {{ try_to_cast_string('m.meta_source') }}                                                     as meta_source
    ,   m.m_patient_id
    ,   m.m_job_id
    ,   m.m_created_at
    ,   m.m_updated_at
    ,   m.m_deleted_at
    ,   m.raw_to_core_job_id
from {{ref('stage__medication')}} m
