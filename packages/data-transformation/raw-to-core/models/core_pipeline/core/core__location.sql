select
      cast(id as {{ dbt.type_string() }} )                                          as location_id
    , cast(name as {{ dbt.type_string() }} )                                        as name
    , cast(
        coalesce(
          type_coding_0_display,
          type_coding_1_display,
          type_coding_2_display,
          type_text
        ) as {{ dbt.type_string() }} 
      )                                                                             as facility_type
    , cast(
        coalesce(
          physicaltype_coding_0_display,
          physicaltype_coding_1_display,
          physicaltype_coding_2_display,
          physicaltype_text
        ) as {{ dbt.type_string() }} 
      )                                                                             as facility_physical_type
    , cast(right(managingorganization_reference, 36) as {{ dbt.type_string() }} )   as parent_organization
    , cast(
        coalesce(
          address_0_text,
          address_1_text,
          address_2_ttext
        ) as {{ dbt.type_string() }} 
      )                                                                             as address
    , cast(
        coalesce(
          ws_concat(address_0_line_0, address_0_line_1, address_0_line_2),
          ws_concat(address_1_line_0, address_1_line_1, address_1_line_2),
          ws_concat(address_2_line_0, address_2_line_1, address_2_line_2),
        ) as {{ dbt.type_string() }} 
      )                                                                             as address_line
    , cast(
        coalesce(
          address_0_city, 
          address_1_city, 
          address_2_city
        ) as {{ dbt.type_string() }} 
      )                                                                             as city
    , cast(
        coalesce(
          address_0_state, 
          address_1_state, 
          address_2_state
        ) as {{ dbt.type_string() }}
      )                                                                             as state
    , cast(
        coalesce(
          address_0_country, 
          address_1_country, 
          address_2_country
        ) as {{ dbt.type_string() }}
      )                                                                             as country
    , cast(
        coalesce(
          address_0_postalcode, 
          address_1_postalcode, 
          address_2_postalcode
        ) as {{ dbt.type_string() }} 
      )                                                                             as zip_code
    , cast(meta_source as {{ dbt.type_string() }} )                                 as data_source
from {{ref('stage__location')}}
