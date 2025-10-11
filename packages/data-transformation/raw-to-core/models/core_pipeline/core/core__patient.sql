with address_with_relative_rank as (
    select 
            *
        ,   row_number() over(partition by patient_id order by processed_date) as relative_rank
    from {{ref('stage__patient_address')}}
),
target_address as (
    select
        *
    from address_with_relative_rank
    where relative_rank = 1
)
select 
        cast(pat.id as {{ dbt.type_string() }} )                                                  as patient_id
    ,   cast(pat.name_0_given_0 as {{ dbt.type_string() }} )                                      as first_name
    ,   cast(pat.name_0_family as {{ dbt.type_string() }} )                                       as last_name
    ,   cast(pat.gender as {{ dbt.type_string() }} )                                              as sex
    ,   {{ try_to_cast_date('pat.birthDate') }}                                                   as birth_date
    ,   cast(ta.line_0 || coalesce(' ' || ta.line_1, '') as {{ dbt.type_string() }} )             as address
    ,   cast(ta.city as {{ dbt.type_string() }} )                                                 as city
    ,   cast(ta.state as {{ dbt.type_string() }} )                                                as state
    ,   cast(ta.postalcode as {{ dbt.type_string() }} )                                           as zip_code
    ,   cast('metriport' as {{ dbt.type_string() }} )                                             as data_source
from {{ref('stage__patient')}} pat
left join target_address ta
    on pat.id = ta.patient_id
