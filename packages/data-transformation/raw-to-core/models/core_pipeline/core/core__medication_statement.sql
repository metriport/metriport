{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('ms.id') }}                                                       as medication_statement_id
    ,   {{ try_to_cast_string('right(ms.subject_reference, 36)') }}                             as patient_id
    ,   {{ try_to_cast_string('right(ms.medicationreference_reference, 36)') }}                 as medication_id
    ,   {{ try_to_cast_string('ms.status') }}                                                   as status
    ,   coalesce(
            {{ try_to_cast_datetime('ms.effectivedatetime') }},
            {{ try_to_cast_datetime('ms.effectiveperiod_start') }}
        )                                                                                       as effective_date
    ,   {{ try_to_cast_datetime('ms.effectiveperiod_end') }}                                    as end_date
    ,   {{ try_to_cast_string('ms.dosage_0_doseandrate_0_dosequantity_unit') }}                 as dose_unit
    ,   {{ try_to_cast_string('ms.dosage_0_doseandrate_0_dosequantity_value') }}                as dose_amount
    ,   {{ try_to_cast_string('ms.note_0_text') }}                                              as note_text
    ,   {{ try_to_cast_string('ms.meta_source') }}                                              as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'ms',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                   as data_source_ext
    ,   {{ try_to_cast_string('ms.meta_source') }}                                              as meta_source
    ,   ms.m_patient_id
    ,   ms.m_job_id
    ,   ms.m_created_at
    ,   ms.m_updated_at
    ,   ms.m_deleted_at
    ,   ms.raw_to_core_job_id
from {{ref('stage__medicationstatement')}} as ms
