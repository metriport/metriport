with tuva_last_run as (
    select
       cast('{{ var('tuva_last_run') }}' as {{ dbt.type_timestamp() }}) as tuva_last_run_datetime
       , cast(substring('{{ var('tuva_last_run') }}', 1, 10) as date) as tuva_last_run_date
)
select
      cast(patient_id as {{ dbt.type_string() }}) as patient_id
    , cast(null as {{ dbt.type_string() }}) as person_id
    , cast(null as {{ dbt.type_string() }}) as name_suffix
    , cast(first_name as {{ dbt.type_string() }}) as first_name
    , cast(null as {{ dbt.type_string() }}) as middle_name
    , cast(last_name as {{ dbt.type_string() }}) as last_name
    , cast(sex as {{ dbt.type_string() }}) as sex
    , cast(race as {{ dbt.type_string() }}) as race
    , {{ try_to_cast_date('birth_date') }} as birth_date
    , {{ try_to_cast_date('death_date') }} as death_date
    , cast(death_flag as {{ dbt.type_int() }}) as death_flag
    , cast(social_security_number as {{ dbt.type_string() }}) as social_security_number
    , cast(address as {{ dbt.type_string() }}) as address
    , cast(city as {{ dbt.type_string() }}) as city
    , cast(state as {{ dbt.type_string() }}) as state
    , cast(zip_code as {{ dbt.type_string() }}) as zip_code
    , cast(county as {{ dbt.type_string() }}) as county
    , cast(latitude as {{ dbt.type_float() }}) as latitude
    , cast(longitude as {{ dbt.type_float() }}) as longitude
    , cast(null as {{ dbt.type_string() }}) as phone
    , cast(null as {{ dbt.type_string() }}) as email
    , cast(null as {{ dbt.type_string() }}) as ethnicity
    , cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) as age
    , cast(
        case
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 10 then '0-9'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 20 then '10-19'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 30 then '20-29'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 40 then '30-39'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 50 then '40-49'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 60 then '50-59'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 70 then '60-69'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 80 then '70-79'
            when cast(floor({{ datediff('birth_date', 'tuva_last_run_date', 'hour') }} / 8760.0) as {{ dbt.type_int() }}) < 90 then '80-89'
            else '90+'
        end as {{ dbt.type_string() }}
    ) as age_group
    , cast(data_source as {{ dbt.type_string() }}) as data_source
    , tuva_last_run_datetime as tuva_last_run
from {{ ref('input_layer__patient') }}
cross join tuva_last_run
