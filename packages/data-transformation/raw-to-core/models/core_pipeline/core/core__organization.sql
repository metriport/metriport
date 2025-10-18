select
      cast(id as {{ dbt.type_string() }} )                                          as organization_id
    , cast(name as {{ dbt.type_string() }} )                                        as name
    , cast(
        coalesce(
          address_0_line_0 
            || coalesce(' ' || address_0_line_1, ''),
          address_1_line_0 
            || coalesce(' ' || address_1_line_1, ''), 
          address_2_line_0 
            || coalesce(' ' || address_2_line_1, ''), 
          address_3_line_0 
            || coalesce(' ' || address_3_line_1, ''),
          address_4_line_0 
            || coalesce(' ' || address_4_line_1, ''),
          address_5_line_0 
            || coalesce(' ' || address_5_line_1, ''),
          address_6_line_0 
            || coalesce(' ' || address_6_line_1, ''),
          address_7_line_0 
            || coalesce(' ' || address_7_line_1, ''),
          address_8_line_0 
            || coalesce(' ' || address_8_line_1, ''),
          address_9_line_0 
            || coalesce(' ' || address_9_line_1, '') 
        ) as {{ dbt.type_string() }} 
      )                                                                             as address_line
    , cast(
        coalesce(
          address_0_city, 
          address_1_city, 
          address_2_city,
          address_3_city,
          address_4_city,
          address_5_city,
          address_6_city,
          address_7_city,
          address_8_city,
          address_9_city
        ) as {{ dbt.type_string() }} 
      )                                                                             as city
    , cast(
        coalesce(
          address_0_state, 
          address_1_state, 
          address_2_state,
          address_3_state,
          address_4_state,
          address_5_state,
          address_6_state,
          address_7_state,
          address_8_state,
          address_9_state
        ) as {{ dbt.type_string() }}
      )                                                                             as state
    , cast(
        coalesce(
          address_0_country, 
          address_1_country, 
          address_2_country,
          address_3_country,
          address_4_country,
          address_5_country,
          address_6_country,
          address_7_country,
          address_8_country,
          address_9_country
        ) as {{ dbt.type_string() }}
      )                                                                             as country
    , cast(
        coalesce(
          address_0_postalcode, 
          address_1_postalcode, 
          address_2_postalcode,
          address_3_postalcode,
          address_4_postalcode,
          address_5_postalcode,
          address_6_postalcode,
          address_7_postalcode,
          address_8_postalcode,
          address_9_postalcode
        ) as {{ dbt.type_string() }} 
      )                                                                             as zip_code
    , cast(meta_source as {{ dbt.type_string() }} )                                 as data_source
from {{ref('stage__organization')}}
