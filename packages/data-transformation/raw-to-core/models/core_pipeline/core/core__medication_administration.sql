{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('ma.id') }}                                                       as medication_administration_id
    ,   {{ try_to_cast_string('right(ma.subject_reference, 36)') }}                             as patient_id
    ,   {{ try_to_cast_string('right(ma.medicationreference_reference, 36)') }}                 as medication_id
    ,   {{ try_to_cast_string('ma.status') }}                                                   as status
    ,   coalesce(
            {{ try_to_cast_datetime('ma.effectivedatetime') }},
            {{ try_to_cast_datetime('ma.effectiveperiod_start') }}
    )                                                                                           as effective_date
    ,   {{ try_to_cast_datetime('ma.effectiveperiod_end') }}                                    as end_date
    ,   {{ try_to_cast_string('ma.dosage_dose_unit') }}                                         as dose_unit
    ,   {{ try_to_cast_string('ma.dosage_dose_value') }}                                        as dose_amount
    ,   {{ try_to_cast_string('ma.note_0_text') }}                                              as note_text
    ,   {{ try_to_cast_string('ma.meta_source') }}                                              as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'ma',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                   as data_source_ext
    ,   {{ try_to_cast_string('ma.meta_source') }}                                              as meta_source
    ,   ma.m_patient_id
    ,   ma.m_job_id
    ,   ma.m_created_at
    ,   ma.m_updated_at
    ,   ma.m_deleted_at
    ,   ma.raw_to_core_job_id
from {{ref('stage__medicationadministration')}} as ma
