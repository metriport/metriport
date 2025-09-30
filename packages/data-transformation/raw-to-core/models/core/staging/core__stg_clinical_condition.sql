select
    cast(condition_id as {{ dbt.type_string() }}) as condition_id
    , cast(null as {{ dbt.type_string() }}) as person_id
    , cast(null as {{ dbt.type_string() }}) as member_id
    , cast(patient_id as {{ dbt.type_string() }}) as patient_id
    , cast(encounter_id as {{ dbt.type_string() }}) as encounter_id
    , cast(claim_id as {{ dbt.type_string() }}) as claim_id
    , {{ try_to_cast_date('recorded_date') }} as recorded_date
    , {{ try_to_cast_date('onset_date') }} as onset_date
    , {{ try_to_cast_date('resolved_date') }} as resolved_date
    , cast(status as {{ dbt.type_string() }}) as status
    , cast(condition_type as {{ dbt.type_string() }}) as condition_type
    , cast(source_code_type as {{ dbt.type_string() }}) as source_code_type
    , cast(source_code as {{ dbt.type_string() }}) as source_code
    , cast(source_description as {{ dbt.type_string() }}) as source_description
    , cast(normalized_code_type as {{ dbt.type_string() }}) as normalized_code_type
    , cast(normalized_code as {{ dbt.type_string() }}) as normalized_code
    , cast(normalized_description as {{ dbt.type_string() }}) as normalized_description
    , cast(condition_rank as {{ dbt.type_int() }}) as condition_rank
    , cast(present_on_admit_code as {{ dbt.type_string() }}) as present_on_admit_code
    , cast(present_on_admit_description as {{ dbt.type_string() }}) as present_on_admit_description
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run
from {{ ref('input_layer__condition') }}
