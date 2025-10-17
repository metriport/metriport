with target_vaccine_code_codings as (
   {{   
        get_target_codings(
            get_immunization_vaccine_codings,
            'immunization_id', 
            2, 
            none, 
            (
                'http://hl7.org/fhir/sid/cvx',
            )
        ) 
    }}
)
select
        cast(i.id as {{ dbt.type_string() }} )                                                              as immunization_id
    ,   cast(right(i.patient_reference, 36) as {{ dbt.type_string() }} )                                    as patient_id
    ,   cast(i.status as {{ dbt.type_string() }} )                                                          as status
    ,   coalesce(
            {{ try_to_cast_date('i.occurrencedatetime') }},
            {{ try_to_cast_date('i.occurrencestring') }}
        )                                                                                                   as occurrence_date
    ,   cast(
            coalesce(
                    cvx.cvx,
                tc_cvx.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as cvx_code
    ,   cast(
            coalesce(
                cvx.long_description,
                tc_cvx.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as cvx_display
    ,   cast(i.dosequantity_value as {{ dbt.type_string() }} )                                              as dose_amount
    ,   cast(i.dosequantity_unit as {{ dbt.type_string() }} )                                               as dose_unit
    ,   cast(
            coalesce(
                i.site_coding_0_display,
                i.site_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as site_diplay
    ,   cast(
            coalesce(
                i.route_coding_0_display,
                i.route_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as route_display
    ,   cast(
            coalesce(
                i.note_0_text,
                i.note_1_text,
                i.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note_text
    ,   cast(
            case 
                when i.performer_0_actor_reference ilike '%practitioner%' 
                    then right(i.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                   as performer_practitioner_id
    ,   cast(
            case 
                when i.performer_0_actor_reference ilike '%organization%' 
                    then right(i.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                   as performer_organization_id
    ,   cast(i.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from {{ref('stage__immunization')}} i
left join target_vaccine_code_codings tc_cvx
    on i.id = tc_cvx.immunization_id 
        and tc_cvx.system = 'http://hl7.org/fhir/sid/cvx'
left join {{ref('terminology__cvx')}} cvx
    on tc_cvx.code = cvx.cvx
