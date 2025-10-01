select
    cast(procedure_id as {{ dbt.type_string() }}) as procedure_id
    , cast(null as {{ dbt.type_string() }}) as person_id
    , cast(null as {{ dbt.type_string() }}) as member_id
    , cast(patient_id as {{ dbt.type_string() }}) as patient_id
    , cast(encounter_id as {{ dbt.type_string() }}) as encounter_id
    , cast(claim_id as {{ dbt.type_string() }}) as claim_id
    , {{ try_to_cast_date('procedure_date', 'YYYY-MM-DD') }} as procedure_date
    , cast(source_code_type as {{ dbt.type_string() }}) as source_code_type
    , cast(source_code as {{ dbt.type_string() }}) as source_code
    , cast(source_description as {{ dbt.type_string() }}) as source_description
    , cast(normalized_code_type as {{ dbt.type_string() }}) as normalized_code_type
    , cast(normalized_code as {{ dbt.type_string() }}) as normalized_code
    , cast(normalized_description as {{ dbt.type_string() }}) as normalized_description
    , cast(modifier_1 as {{ dbt.type_string() }}) as modifier_1
    , cast(modifier_2 as {{ dbt.type_string() }}) as modifier_2
    , cast(modifier_3 as {{ dbt.type_string() }}) as modifier_3
    , cast(modifier_4 as {{ dbt.type_string() }}) as modifier_4
    , cast(modifier_5 as {{ dbt.type_string() }}) as modifier_5
    , cast(practitioner_id as {{ dbt.type_string() }}) as practitioner_id
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run
from {{ ref('input_layer__procedure') }}
