select
    cast(medication_id as {{ dbt.type_string() }}) as medication_id
    , cast(null as {{ dbt.type_string() }}) as person_id
    , cast(patient_id as {{ dbt.type_string() }}) as patient_id
    , cast(encounter_id as {{ dbt.type_string() }}) as encounter_id
    , {{ try_to_cast_date('dispensing_date', 'YYYY-MM-DD') }} as dispensing_date
    , {{ try_to_cast_date('prescribing_date', 'YYYY-MM-DD') }} as prescribing_date
    , cast(source_code_type as {{ dbt.type_string() }}) as source_code_type
    , cast(source_code as {{ dbt.type_string() }}) as source_code
    , cast(source_description as {{ dbt.type_string() }}) as source_description
    , cast(ndc_code as {{ dbt.type_string() }}) as ndc_code
    , cast(ndc_description as {{ dbt.type_string() }}) as ndc_description
    , cast(rxnorm_code as {{ dbt.type_string() }}) as rxnorm_code
    , cast(rxnorm_description as {{ dbt.type_string() }}) as rxnorm_description
    , cast(atc_code as {{ dbt.type_string() }}) as atc_code
    , cast(atc_description as {{ dbt.type_string() }}) as atc_description
    , cast(route as {{ dbt.type_string() }}) as route
    , cast(strength as {{ dbt.type_string() }}) as strength
    , cast(quantity as {{ dbt.type_int() }}) as quantity
    , cast(quantity_unit as {{ dbt.type_string() }}) as quantity_unit
    , cast(days_supply as {{ dbt.type_int() }}) as days_supply
    , cast(practitioner_id as {{ dbt.type_string() }}) as practitioner_id
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run
from {{ ref('input_layer__medication') }}
