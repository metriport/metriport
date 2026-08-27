{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
      {{ try_to_cast_string('org.id') }}                                                    as organization_id
    , {{ try_to_cast_string('org.name') }}                                                  as name
    , trim(
          coalesce(nullif({{ try_to_cast_string('org.address_0_line_0') }}, ''), '')
          || case 
              when {{ try_to_cast_string('org.address_0_line_1') }} is not null 
                and {{ try_to_cast_string('org.address_0_line_1') }} != ''
                and coalesce(nullif({{ try_to_cast_string('org.address_0_line_0') }}, ''), '') != ''
              then ' ' || {{ try_to_cast_string('org.address_0_line_1') }}
              when {{ try_to_cast_string('org.address_0_line_1') }} is not null 
                and {{ try_to_cast_string('org.address_0_line_1') }} != ''
              then {{ try_to_cast_string('org.address_0_line_1') }}
              else ''
          end
      )                                                                                   as address_line
    , {{ try_to_cast_string('org.address_0_city') }}                                        as city
    , {{ try_to_cast_string('org.address_0_state') }}                                       as state
    , {{ try_to_cast_string('org.address_0_country') }}                                     as country
    , {{ try_to_cast_string('org.address_0_postalcode') }}                                  as zip_code
    , {{ try_to_cast_string('org.meta_source') }}                                           as data_source
    {#- Data source extension: extension with data-source URL -#}
    , {{ try_to_cast_string(get_inline_extension(
            'org',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
      )) }}                                                                                 as data_source_ext
    , {{ try_to_cast_string('org.meta_source') }}                                           as meta_source
    , org.m_patient_id
    , org.m_job_id
    , org.m_created_at
    , org.m_updated_at
    , org.m_deleted_at
    , org.raw_to_core_job_id
from {{ref('stage__organization')}} org
