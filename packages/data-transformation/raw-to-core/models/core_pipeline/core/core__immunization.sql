with base_resource as (
    select
        id,
        patient_reference,
        status,
        occurrencedatetime,
        occurrencestring,
        vaccinecode_coding_0_code,
        vaccinecode_coding_0_display,
        vaccinecode_coding_0_system,
        dosequantity_value,
        dosequantity_unit,
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
            4, 
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
    ,   cast(tc_cvx.code as {{ dbt.type_string() }} )                                                       as cvx_code
    ,   cast(tc_cvx.display as {{ dbt.type_string() }} )                                                    as cvx_display
    ,   cast(i.vaccinecode_coding_0_code as {{ dbt.type_string() }} )                                       as source_vaccine_code_code
    ,   cast(i.vaccinecode_coding_0_display as {{ dbt.type_string() }} )                                    as source_vaccine_code_display
    ,   cast(i.vaccinecode_coding_0_system as {{ dbt.type_string() }} )                                     as source_vaccine_code_system
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
