{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('md.id') }}                                                       as medication_dispense_id
    ,   {{ try_to_cast_string('right(md.subject_reference, 36)') }}                             as patient_id
    ,   {{ try_to_cast_string('right(md.medicationreference_reference, 36)') }}                 as medication_id
    ,   {{ try_to_cast_string('md.status') }}                                                   as status
    ,   {{ try_to_cast_datetime('md.whenhandedover') }}                                         as when_handed_over
    ,   {{ try_to_cast_datetime('md.whenprepared') }}                                           as when_prepared
    ,   coalesce(
          {{ try_to_cast_string('md.quantity_unit') }},
          {{ try_to_cast_string('md.dosageinstruction_0_doseandrate_0_dosequantity_unit') }}
        )                                                                                       as dose_unit
    ,   coalesce(
          {{ try_to_cast_string('md.quantity_value') }},
          {{ try_to_cast_string('md.dosageinstruction_0_doseandrate_0_dosequantity_value') }}
        )                                                                                       as dose_amount
    ,   {{ try_to_cast_string('md.dayssupply_value') }}                                         as days_supply_amount
    ,   {{ try_to_cast_string('md.dayssupply_unit') }}                                          as days_supply_unit
    ,   {{ try_to_cast_string('md.note_0_text') }}                                              as note_text
    ,   {{ try_to_cast_string('md.meta_source') }}                                              as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'md',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                   as data_source_ext
    ,   {{ try_to_cast_string('md.meta_source') }}                                              as meta_source
    ,   md.m_patient_id
    ,   md.m_job_id
    ,   md.m_created_at
    ,   md.m_updated_at
    ,   md.m_deleted_at
    ,   md.raw_to_core_job_id
from {{ref('stage__medicationdispense')}} as md
