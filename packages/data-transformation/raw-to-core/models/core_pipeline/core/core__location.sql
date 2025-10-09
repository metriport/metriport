select
      cast(l.id as {{ dbt.type_string() }} ) as location_id
    , cast(null as {{ dbt.type_string() }} ) as npi
    , cast(l.name as {{ dbt.type_string() }} ) as name
    , cast(l.physicaltype_text as {{ dbt.type_string() }} ) as facility_type
    , cast(l.managingorganization_reference as {{ dbt.type_string() }} ) as parent_organization
    , cast(coalesce(l.address_0_text, 
                    case when l.address_0_line_0 is not null and l.address_0_line_0 != '' 
                         then concat_ws(', ', l.address_0_line_0, l.address_0_city, l.address_0_state, l.address_0_postalcode)
                         else null end) as {{ dbt.type_string() }} ) as address
    , cast(coalesce(l.address_0_city, l.address_1_city, l.address_2_city) as {{ dbt.type_string() }} ) as city
    , cast(coalesce(l.address_0_state, l.address_1_state, l.address_2_state) as {{ dbt.type_string() }} ) as state
    , cast(coalesce(l.address_0_postalcode, l.address_1_postalcode, l.address_2_postalcode) as {{ dbt.type_string() }} ) as zip_code
    , cast(case when l.position_latitude != '' and l.position_latitude is not null then l.position_latitude else null end as {{ dbt.type_float() }} ) as latitude
    , cast(case when l.position_longitude != '' and l.position_longitude is not null then l.position_longitude else null end as {{ dbt.type_float() }} ) as longitude
    , cast(l.meta_source as {{ dbt.type_string() }} ) as data_source
from {{ref('stage__location')}} l
