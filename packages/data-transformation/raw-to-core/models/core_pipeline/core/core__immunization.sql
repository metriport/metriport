with base_resource as (
    select
        id,
        patient_reference,
        status,
        occurrencedatetime,
        occurrencestring,
        dosequantity_value,
        dosequantity_unit,
        route_text,
        note_0_text,
        note_1_text,
        note_2_text,
        meta_source
    from {{ref('stage__immunization')}}
),
target_vaccine_code_codings as (
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
                i.note_0_text,
                i.note_1_text,
                i.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note_text
    ,   cast(i.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from base_resource i
left join target_vaccine_code_codings tc_cvx
    on i.id = tc_cvx.immunization_id 
        and tc_cvx.system = 'http://hl7.org/fhir/sid/cvx'
left join {{ref('terminology__cvx')}} cvx
    on tc_cvx.code = cvx.cvx
