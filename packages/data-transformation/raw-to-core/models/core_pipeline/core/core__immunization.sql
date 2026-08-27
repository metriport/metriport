{{ config(unique_key='m_patient_id') }}
{% set vaccinecode_coding_max_index = 4 %}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('i.id') }}                                                                as immunization_id
    ,   {{ try_to_cast_string('right(i.patient_reference, 36)') }}                                      as patient_id
    ,   {{ try_to_cast_string('i.status') }}                                                            as status
    ,   coalesce(
            {{ try_to_cast_datetime('i.occurrencedatetime') }},
            {{ try_to_cast_datetime('i.occurrencestring') }}
        )                                                                                               as occurrence_date
    {#- CVX: Check each vaccinecode_coding index 0-4 (5 values), normalize system -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'i',
            'vaccinecode_coding',
            'http://hl7.org/fhir/sid/cvx',
            vaccinecode_coding_max_index,
            'code'
        )) }} as cvx_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'i',
            'vaccinecode_coding',
            'http://hl7.org/fhir/sid/cvx',
            vaccinecode_coding_max_index,
            'display'
        )) }} as cvx_display
    ,   {{ try_to_cast_string('i.vaccinecode_coding_0_code') }}                                         as source_vaccine_code_code
    ,   {{ try_to_cast_string('i.vaccinecode_coding_0_display') }}                                      as source_vaccine_code_display
    ,   {{ try_to_cast_string('i.vaccinecode_coding_0_system') }}                                       as source_vaccine_code_system
    ,   {{ try_to_cast_string('i.dosequantity_value') }}                                                as dose_amount
    ,   {{ try_to_cast_string('i.dosequantity_unit') }}                                                 as dose_unit
    ,   {{ try_to_cast_string('i.note_0_text') }}                                                       as note_text
    ,   {{ try_to_cast_string('i.meta_source') }}                                                       as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'i',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                           as data_source_ext
    ,   {{ try_to_cast_string('i.meta_source') }}                                                       as meta_source
    ,   i.m_patient_id
    ,   i.m_job_id
    ,   i.m_created_at
    ,   i.m_updated_at
    ,   i.m_deleted_at
    ,   i.raw_to_core_job_id
from {{ref('stage__immunization')}} i
