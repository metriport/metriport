select
      cast(practitioner_id as {{ dbt.type_string() }}) as practitioner_id
    , cast(npi as {{ dbt.type_string() }}) as npi
    , cast(first_name as {{ dbt.type_string() }}) as first_name
    , cast(last_name as {{ dbt.type_string() }}) as last_name
    , cast(practice_affiliation as {{ dbt.type_string() }}) as practice_affiliation
    , cast(specialty as {{ dbt.type_string() }}) as specialty
    , cast(sub_specialty as {{ dbt.type_string() }}) as sub_specialty
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run
from {{ ref('input_layer__practitioner') }}
