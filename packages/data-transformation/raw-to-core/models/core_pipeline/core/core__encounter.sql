{{ config(unique_key='m_patient_id') }}
{% set type_coding_max_index = 1 %}
{% set type_secondary_coding_max_index = 1 %}
{% set hospitalization_dischargedisposition_coding_max_index = 1 %}
{% set reasoncode_coding_max_index = 1 %}
{% set reasoncode_secondary_coding_max_index = 1 %}
{% set extension_max_index = 2 %}

select
        {{ try_to_cast_string('enc.id') }}                                                      as encounter_id      
    ,   {{ try_to_cast_string('right(enc.subject_reference, 36)') }}                            as patient_id
    ,   {{ try_to_cast_string('enc.status') }}                                                  as status
    ,   {{ try_to_cast_datetime('enc.period_start') }}                                          as start_date
    ,   {{ try_to_cast_datetime('enc.period_end') }}                                            as end_date
    ,   {{ 
            dbt.datediff(
                try_to_cast_date('enc.period_start', 'YYYY-MM-DD'),
                try_to_cast_date('enc.period_end', 'YYYY-MM-DD'),
                'day'
            )
        }}                                                                                      as length_of_stay
    ,   case 
            when enc.class_system ilike '%v3-ActCode%' then {{ try_to_cast_string('enc.class_code') }}
            else null
        end                                                                                     as act_code
    ,   case 
            when enc.class_system ilike '%v3-ActCode%' then {{ try_to_cast_string('enc.class_display') }}
            else null
        end                                                                                     as act_display
    ,   {{ try_to_cast_string('enc.class_code') }}                                              as source_class_code
    ,   {{ try_to_cast_string('enc.class_display') }}                                           as source_class_display
    ,   {{ try_to_cast_string('enc.class_system') }}                                            as source_class_system
    {#- Type HL7: Check nested type_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'enc',
            'type',
            'http://terminology.hl7.org/CodeSystem/encounter-type',
            type_coding_max_index,
            type_secondary_coding_max_index,
            'code'
        )) }} as type_hl7_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'enc',
            'type',
            'http://terminology.hl7.org/CodeSystem/encounter-type',
            type_coding_max_index,
            type_secondary_coding_max_index,
            'display'
        )) }} as type_hl7_display
    ,   {{ try_to_cast_string('enc.type_0_coding_0_code') }}                                    as source_type_code
    ,   {{ try_to_cast_string('enc.type_0_coding_0_display') }}                                 as source_type_display
    ,   {{ try_to_cast_string('enc.type_0_coding_0_system') }}                                  as source_type_system
    {#- Discharge Disposition HL7: Check hospitalization_dischargedisposition_coding indices 0-1 -#}
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'enc',
            'hospitalization_dischargedisposition_coding',
            'http://terminology.hl7.org/CodeSystem/discharge-disposition',
            hospitalization_dischargedisposition_coding_max_index,
            'code'
        )) }} as discharge_disposition_hl7_code
    ,   {{ try_to_cast_string(get_inline_coding_case(
            'enc',
            'hospitalization_dischargedisposition_coding',
            'http://terminology.hl7.org/CodeSystem/discharge-disposition',
            hospitalization_dischargedisposition_coding_max_index,
            'display'
        )) }} as discharge_disposition_hl7_display
    ,   {{ try_to_cast_string('enc.hospitalization_dischargedisposition_coding_0_code') }}      as source_discharge_disposition_code                           
    ,   {{ try_to_cast_string('enc.hospitalization_dischargedisposition_coding_0_display') }}   as source_discharge_disposition_display                     
    ,   {{ try_to_cast_string('enc.hospitalization_dischargedisposition_coding_0_system') }}    as source_discharge_disposition_system                         
    {#- Reason SNOMED: Check nested reasoncode_i_coding_j structure -#}
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'enc',
            'reasoncode',
            'http://snomed.info/sct',
            reasoncode_coding_max_index,
            reasoncode_secondary_coding_max_index,
            'code'
        )) }} as reason_snomed_code
    ,   {{ try_to_cast_string(get_inline_nested_coding_case(
            'enc',
            'reasoncode',
            'http://snomed.info/sct',
            reasoncode_coding_max_index,
            reasoncode_secondary_coding_max_index,
            'display'
        )) }} as reason_snomed_display
    ,   {{ try_to_cast_string('enc.meta_source') }}                                             as data_source
    {#- Data source extension: extension with data-source URL -#}
    ,   {{ try_to_cast_string(get_inline_extension(
            'enc',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                   as data_source_ext
    ,   {{ try_to_cast_string('enc.meta_source') }}                                             as meta_source
    ,   enc.m_patient_id
    ,   enc.m_job_id
    ,   enc.m_created_at
    ,   enc.m_updated_at
    ,   enc.m_deleted_at
    ,   enc.raw_to_core_job_id
from {{ref('stage__encounter')}} as enc
