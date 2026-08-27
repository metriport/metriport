{{ config(unique_key='m_patient_id') }}
{% set code_coding_max_index = 4 %}
{% set category_coding_max_index = 1 %}
{% set category_secondary_coding_max_index = 1 %}
{% set interpretation_coding_max_index = 1 %}
{% set interpretation_secondary_coding_max_index = 1 %}
{% set bodysite_coding_max_index = 1 %}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('obvs.id') }}                                                   as observation_id
    ,   {{ try_to_cast_string('right(obvs.subject_reference, 36)') }}                         as patient_id
    ,   {{ try_to_cast_string('obvs.status') }}                                               as status
    ,   coalesce(
            {{ try_to_cast_datetime('obvs.effectivedatetime') }}, 
            {{ try_to_cast_datetime('obvs.effectiveperiod_start') }} 
        )                                                                                     as effective_date
    ,   {{ try_to_cast_datetime('obvs.effectiveperiod_end') }}                                as end_date
    {#- LOINC: Check each code_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'obvs',
            'code_coding',
            'http://loinc.org',
            code_coding_max_index,
            'code'
        )) }} as loinc_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'obvs',
            'code_coding',
            'http://loinc.org',
            code_coding_max_index,
            'display'
        )) }} as loinc_display
    ,   {{ try_to_cast_string('obvs.code_coding_0_code') }}                                   as source_code_code
    ,   {{ try_to_cast_string('obvs.code_coding_0_display') }}                                as source_code_display
    ,   {{ try_to_cast_string('obvs.code_coding_0_system') }}                                 as source_code_system
    ,   coalesce(
          {{ try_to_cast_string('obvs.valuequantity_value') }},
          {{ try_to_cast_string('obvs.valuestring') }},
          {{ try_to_cast_string('obvs.valuecodeableconcept_text') }},
          {{ try_to_cast_string('obvs.valuecodeableconcept_coding_0_display') }}
        )                                                                                     as value
    ,   coalesce(
          {{ try_to_cast_string('obvs.valuequantity_unit') }},
          {{ try_to_cast_string('obvs.referencerange_0_high_unit') }},
          {{ try_to_cast_string('obvs.referencerange_0_low_unit') }}
        )                                                                                     as units
    ,   {{ try_to_cast_string('obvs.referencerange_0_low_value') }}                           as reference_range_low
    ,   {{ try_to_cast_string('obvs.referencerange_0_high_value') }}                          as reference_range_high
    {#- Category HL7: Check nested category_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'obvs',
            'category',
            'http://terminology.hl7.org/CodeSystem/observation-category',
            category_coding_max_index,
            category_secondary_coding_max_index,
            'code'
        )) }} as category_hl7_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'obvs',
            'category',
            'http://terminology.hl7.org/CodeSystem/observation-category',
            category_coding_max_index,
            category_secondary_coding_max_index,
            'display'
        )) }} as category_hl7_display
    {#- Interpretation HL7: Check nested interpretation_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'obvs',
            'interpretation',
            'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            interpretation_coding_max_index,
            interpretation_secondary_coding_max_index,
            'code'
        )) }} as interpretation_hl7_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'obvs',
            'interpretation',
            'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            interpretation_coding_max_index,
            interpretation_secondary_coding_max_index,
            'display'
        )) }} as interpretation_hl7_display
    {#- Body site SNOMED: Check bodysite_coding indices 0-1 -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'obvs',
            'bodysite_coding',
            'http://snomed.info/sct',
            bodysite_coding_max_index,
            'code'
        )) }} as bodysite_snomed_ct_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'obvs',
            'bodysite_coding',
            'http://snomed.info/sct',
            bodysite_coding_max_index,
            'display'
        )) }} as bodysite_snomed_ct_display
    ,   {{ try_to_cast_string('obvs.note_0_text') }}                                          as note_text
    ,   {{ try_to_cast_string('obvs.meta_source') }}                                          as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'obvs',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                 as data_source_ext
    ,   {{ try_to_cast_string('obvs.meta_source') }}                                          as meta_source
    ,   obvs.m_patient_id
    ,   obvs.m_job_id
    ,   obvs.m_created_at
    ,   obvs.m_updated_at
    ,   obvs.m_deleted_at
    ,   obvs.raw_to_core_job_id
from {{ref('stage__observation')}} obvs
