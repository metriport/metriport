{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
      {{ try_to_cast_string('loc.id') }}                                                          as location_id
    , {{ try_to_cast_string('loc.name') }}                                                        as name
    , {{ try_to_cast_string('loc.type_coding_0_display') }}                                       as type_display
    , {{ try_to_cast_string('loc.physicaltype_coding_0_display') }}                               as physical_type_display
    , {{ try_to_cast_string('right(loc.managingorganization_reference, 36)') }}                   as managing_organization_id
    , {{ try_to_cast_string('loc.address_0_text') }}                                              as address
    , trim(
          coalesce(nullif({{ try_to_cast_string('loc.address_0_line_0') }}, ''), '')
          || case 
              when {{ try_to_cast_string('loc.address_0_line_1') }} is not null 
                and {{ try_to_cast_string('loc.address_0_line_1') }} != ''
                and coalesce(nullif({{ try_to_cast_string('loc.address_0_line_0') }}, ''), '') != ''
              then ' ' || {{ try_to_cast_string('loc.address_0_line_1') }}
              when {{ try_to_cast_string('loc.address_0_line_1') }} is not null 
                and {{ try_to_cast_string('loc.address_0_line_1') }} != ''
              then {{ try_to_cast_string('loc.address_0_line_1') }}
              else ''
          end
      )                                                                                           as address_line
    , {{ try_to_cast_string('loc.address_0_city') }}                                              as city
    , {{ try_to_cast_string('loc.address_0_state') }}                                             as state
    , {{ try_to_cast_string('loc.address_0_country') }}                                           as country
    , {{ try_to_cast_string('loc.address_0_postalcode') }}                                        as zip_code
    , {{ try_to_cast_string('loc.meta_source') }}                                                 as data_source
    {#- Data source extension: extension with data-source URL -#}
    , {{ try_to_cast_string(get_inline_extension(
            'loc',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                                     as data_source_ext
    , {{ try_to_cast_string('loc.meta_source') }}                                                 as meta_source
    , loc.m_patient_id
    , loc.m_job_id
    , loc.m_created_at
    , loc.m_updated_at
    , loc.m_deleted_at
    , loc.raw_to_core_job_id
from {{ref('stage__location')}} loc
