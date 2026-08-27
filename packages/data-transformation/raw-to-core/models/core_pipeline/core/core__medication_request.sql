{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('mr.id') }}                                                       as medication_request_id
    ,   {{ try_to_cast_string('right(mr.subject_reference, 36)') }}                             as patient_id
    ,   {{ try_to_cast_string('right(mr.medicationreference_reference, 36)') }}                 as medication_id
    ,   {{ try_to_cast_string('mr.status') }}                                                   as status
    ,   {{ try_to_cast_datetime('mr.authoredon') }}                                             as authored_on
    ,   {{ try_to_cast_string('mr.dosageinstruction_0_doseandrate_0_dosequantity_unit') }}      as dose_unit
    ,   {{ try_to_cast_string('mr.dosageinstruction_0_doseandrate_0_dosequantity_value') }}     as dose_amount
    ,   {{ try_to_cast_string('mr.note_0_text') }}                                              as note_text    
    ,   {{ try_to_cast_string('mr.intent') }}                                                   as intent
    ,   {{ try_to_cast_string('mr.meta_source') }}                                              as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'mr',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                   as data_source_ext
    ,   {{ try_to_cast_string('mr.meta_source') }}                                              as meta_source
    ,   mr.m_patient_id
    ,   mr.m_job_id
    ,   mr.m_created_at
    ,   mr.m_updated_at
    ,   mr.m_deleted_at
    ,   mr.raw_to_core_job_id
from {{ref('stage__medicationrequest')}} as mr
