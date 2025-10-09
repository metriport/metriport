with codings as (
    {{ get_immunization_codings('stage__immunization', 2) }}
),
codings_with_static_rank as (
    select 
            immunization_id
        ,   code
        ,   system
        ,   display
        ,   case 
                when system = 'cvx' then 0
                when system = 'snomed-ct' then 1
                else 2
            end as static_rank
    from codings
),
codings_with_relative_rank as (
    select
            immunization_id
        ,   code
        ,   system
        ,   display
        ,   row_number() over(partition by immunization_id order by static_rank) as relative_rank
    from codings_with_static_rank
),
target_coding as (
    select
        *
    from codings_with_relative_rank
    where relative_rank = 1
)
select
        cast(i.id as {{ dbt.type_string() }} )                                                            as immunization_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                            as patient_id
    ,   cast(null as {{ dbt.type_string() }} )                                                            as encounter_id
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                       as source_code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                         as source_code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                      as source_description
    ,   cast(
            case
                when cvx.cvx is not null then 'cvx'
                when snomed.snomed_ct is not null then 'snomed-ct'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                 as normalized_code_type
    ,   cast(
            coalesce(
                cvx.cvx, 
                snomed.snomed_ct
            ) as {{ dbt.type_string() }} 
        )                                                                                                 as normalized_code
    ,   cast(
            coalesce(
                cvx.long_description, 
                snomed.description
            ) as {{ dbt.type_string() }} 
        )                                                                                                 as normalized_description
    ,   cast(i.status as {{ dbt.type_string() }} )                                                        as status
    ,   cast(i.statusreason_text as {{ dbt.type_string() }} )                                             as status_reason
    ,   coalesce(
            {{ try_to_cast_date('i.occurrencedatetime') }},
            {{ try_to_cast_date('i.occurrencestring') }}
        )                                                                                                 as occurrence_date
    ,   cast(i.dosequantity_value as {{ dbt.type_string() }} )                                            as dose_amount
    ,   cast(i.dosequantity_unit as {{ dbt.type_string() }} )                                             as dose_unit
    ,   cast(i.lotnumber as {{ dbt.type_string() }} )                                                     as lot_number
    ,   cast(i.site_coding_0_display as {{ dbt.type_string() }} )                                         as body_site
    ,   cast(i.route_coding_0_display as {{ dbt.type_string() }} )                                        as route
    ,   cast(right(i.performer_0_actor_reference, 36) as {{ dbt.type_string() }} )                        as practitioner_id
    ,   cast(i.meta_source as {{ dbt.type_string() }} )                                                   as data_source
from {{ref('stage__immunization')}} i
left join {{ref('stage__patient')}} p
    on right(i.patient_reference, 36) = p.id
left join target_coding tc
    on i.id = tc.immunization_id
left join {{ref('terminology__cvx')}} cvx
    on tc.system = 'cvx' and tc.code = cvx.cvx
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
