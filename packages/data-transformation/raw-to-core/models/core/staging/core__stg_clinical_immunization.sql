select
    cast(immunization_id as {{ dbt.type_string() }}) as immunization_id
    , cast(null as {{ dbt.type_string() }}) as person_id
    , cast(patient_id as {{ dbt.type_string() }}) as patient_id
    , cast(encounter_id as {{ dbt.type_string() }}) as encounter_id
    , cast(source_code_type as {{ dbt.type_string() }}) as source_code_type
    , cast(source_code as {{ dbt.type_string() }}) as source_code
    , cast(source_description as {{ dbt.type_string() }}) as source_description
    , cast(normalized_code_type as {{ dbt.type_string() }}) as normalized_code_type
    , cast(normalized_code as {{ dbt.type_string() }}) as normalized_code
    , cast(normalized_description as {{ dbt.type_string() }}) as normalized_description
    , cast(status as {{ dbt.type_string() }}) as status
    , cast(status_reason as {{ dbt.type_string() }}) as status_reason
    , {{ try_to_cast_date('occurrence_date', 'YYYY-MM-DD') }} as occurrence_date
    , cast(source_dose as {{ dbt.type_string() }}) as source_dose
    , cast(normalized_dose as {{ dbt.type_string() }}) as normalized_dose
    , cast(lot_number as {{ dbt.type_string() }}) as lot_number
    , cast(body_site as {{ dbt.type_string() }}) as body_site
    , cast(route as {{ dbt.type_string() }}) as route
    , cast(location_id as {{ dbt.type_string() }}) as location_id
    , cast(practitioner_id as {{ dbt.type_string() }}) as practitioner_id
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run
from {{ ref('input_layer__immunization') }}
