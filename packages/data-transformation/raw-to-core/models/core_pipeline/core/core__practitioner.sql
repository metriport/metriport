{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
      {{ try_to_cast_string('prac.id') }}                                    as practitioner_id
    , {{ try_to_cast_string('prac.name_0_given_0') }}                        as first_name
    , {{ try_to_cast_string('prac.name_0_family') }}                         as last_name
    , coalesce(
          {{ try_to_cast_string('prac.qualification_0_code_coding_0_display') }},
          {{ try_to_cast_string('prac.qualification_0_code_text') }}
      )                                                                      as specialty
    , {{ try_to_cast_string('prac.meta_source') }}                           as data_source
    {#- Data source extension: extension with data-source URL -#}
    , {{ try_to_cast_string(get_inline_extension(
            'prac',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
      )) }}                                                                  as data_source_ext
    , {{ try_to_cast_string('prac.meta_source') }}                           as meta_source
    , prac.m_patient_id
    , prac.m_job_id
    , prac.m_created_at
    , prac.m_updated_at
    , prac.m_deleted_at
    , prac.raw_to_core_job_id
from {{ref('stage__practitioner')}} prac
