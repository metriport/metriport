with target_type_coding as (
   {{   
        get_target_coding(
            get_encounter_type_codings,
            'stage__encounter', 
            'procedure_id', 
            7, 
            none, 
            encounter_type_code_system
        ) 
    }}
),
target_discharge_disposition_coding as (
    {{ 
        get_target_coding(
            get_encounter_discharge_disposition_codings, 
            'stage__encounter', 
            'procedure_id', 
            1, 
            2, 
            encounter_discharge_disposition_code_system
        ) }}
),
target_priority_coding as (
    {{ 
        get_target_coding(
            get_encounter_priority_codings, 
            'stage__encounter', 
            'encounter_id', 
            9, 
            0,
            encounter_priority_code_system
        ) 
    }}
)
select
        cast(enc.id as {{ dbt.type_string() }} )                                                as encounter_id      
    ,   cast(p.id as {{ dbt.type_string() }} )                                                  as patient_id
    ,   cast(enc.status as {{ dbt.type_string() }} )                                            as status
    ,   {{ try_to_cast_date('enc.period_start', 'YYYY-MM-DD') }}                                as encounter_start_date
    ,   {{ try_to_cast_date('enc.period_end', 'YYYY-MM-DD') }}                                  as encounter_end_date
    ,   {{ 
            dbt.datediff(
                try_to_cast_date('enc.period_start', 'YYYY-MM-DD'),
                try_to_cast_date('enc.period_end', 'YYYY-MM-DD'),'day'
            ) 
        }}                                                                                      as length_of_stay
    ,   cast(tc_type.system  as {{ dbt.type_string() }} )                                       as type_code_type
    ,   cast(tc_type.code  as {{ dbt.type_string() }} )                                         as type_code
    ,   cast(tc_type.display  as {{ dbt.type_string() }} )                                      as type_description
    ,   cast(enc.class_system as {{ dbt.type_string() }} )                                      as class_code_type
    ,   cast(enc.class_code as {{ dbt.type_string() }} )                                        as class_code
    ,   cast(enc.class_display as {{ dbt.type_string() }} )                                     as class_description

    ,   cast(tc_dd.system as {{ dbt.type_string() }} )                                          as discharge_disposition_code_type
    ,   cast(tc_dd.code as {{ dbt.type_string() }} )                                            as discharge_disposition_code
    ,   cast(tc_dd.display as {{ dbt.type_string() }} )                                         as discharge_disposition_description
    ,   cast(tc_pr.system as {{ dbt.type_string() }} )                                          as priority_code_type
    ,   cast(tc_pr.code as {{ dbt.type_string() }} )                                            as priority_code
    ,   cast(tc_pr.display as {{ dbt.type_string() }} )                                         as priority_description
    ,   cast(right(enc.participant_0_individual_reference, 36) as {{ dbt.type_string() }} )     as practitioner_id
    ,   cast(right(enc.location_0_location_reference, 36) as {{ dbt.type_string() }} )          as facility_id
    ,   cast(right(enc.serviceprovider_reference, 36) as {{ dbt.type_string() }} )              as organization_id
    ,   cast(enc.meta_source as {{ dbt.type_string() }} )                                       as data_source
from {{ ref('stage__encounter') }} as enc
left join {{ref('stage__patient') }} p
    on right(enc.subject_reference, 36) = p.id
left join target_type_coding tc_type
    on enc.id = tc_type.encounter_id
left join target_discharge_disposition_coding tc_dd
    on enc.id = tc_dd.encounter_id
left join target_priority_coding tc_pr
    on enc.id = tc_pr.encounter_id
