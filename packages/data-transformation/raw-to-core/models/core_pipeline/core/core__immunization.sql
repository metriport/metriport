with target_vaccine_coding as (
   {{   
        get_target_coding(
            get_immunization_vaccine_codings,
            'stage__immunization', 
            'immunization_id', 
            2, 
            none, 
            immunization_vaccine_code_system
        ) 
    }}
)
select
        cast(i.id as {{ dbt.type_string() }} )                                                              as immunization_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                              as patient_id
    ,   cast(i.status as {{ dbt.type_string() }} )                                                          as status
    ,   coalesce(
            {{ try_to_cast_date('i.occurrencedatetime') }},
            {{ try_to_cast_date('i.occurrencestring') }}
        )                                                                                                   as occurrence_date
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                         as source_vaccine_code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                           as source_vaccine_code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                        as source_vaccine_description
    ,   cast(
            case
                when cvx.cvx is not null then 'cvx'
                when snomed.snomed_ct is not null then 'snomed-ct'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_vaccine_code_type
    ,   cast(
            coalesce(
                cvx.cvx, 
                snomed.snomed_ct
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_vaccine_code
    ,   cast(
            coalesce(
                cvx.long_description, 
                snomed.description
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_vaccine_description
    ,   cast(i.dosequantity_value as {{ dbt.type_string() }} )                                              as dose_amount
    ,   cast(i.dosequantity_unit as {{ dbt.type_string() }} )                                               as dose_unit
    ,   cast(
            coalesce(
                i.site_coding_0_display,
                i.site_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as site
    ,   cast(
            coalesce(
                i.route_coding_0_display,
                i.route_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as route
    ,   cast(
            coalesce(
                i.note_0_text,
                i.note_1_text,
                i.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note
    ,   cast(right(i.performer_0_actor_reference, 36) as {{ dbt.type_string() }} )                          as practitioner_id
    ,   cast(i.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from {{ref('stage__immunization')}} i
left join {{ref('stage__patient')}} p
    on right(i.patient_reference, 36) = p.id
left join target_vaccine_coding tc
    on i.id = tc.immunization_id
left join {{ref('terminology__cvx')}} cvx
    on tc.system = 'cvx' and tc.code = cvx.cvx
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
