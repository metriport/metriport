select
    cast(location_id as {{ dbt.type_string() }}) as location_id
    , cast(npi as {{ dbt.type_string() }}) as npi
    , cast(name as {{ dbt.type_string() }}) as name
    , cast(facility_type as {{ dbt.type_string() }}) as facility_type
    , cast(parent_organization as {{ dbt.type_string() }}) as parent_organization
    , cast(address as {{ dbt.type_string() }}) as address
    , cast(city as {{ dbt.type_string() }}) as city
    , cast(state as {{ dbt.type_string() }}) as state
    , cast(zip_code as {{ dbt.type_string() }}) as zip_code
    , cast(latitude as {{ dbt.type_float() }}) as latitude
    , cast(longitude as {{ dbt.type_float() }}) as longitude
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run
from {{ ref('input_layer__location') }}
