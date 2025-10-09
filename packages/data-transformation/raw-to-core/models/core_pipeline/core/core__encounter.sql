select
        cast(enc.id as {{ dbt.type_string() }} )                                                as encounter_id      
    ,   cast(p.id as {{ dbt.type_string() }} )                                                  as patient_id
    ,   cast(type_0_coding_0_system  as {{ dbt.type_string() }} )                               as type_code_type
    ,   cast(type_0_coding_0_code  as {{ dbt.type_string() }} )                                 as type_code
    ,   cast(type_0_coding_0_display  as {{ dbt.type_string() }} )                              as type_description
    ,   cast(enc.class_system as {{ dbt.type_string() }} )                                      as class_code_type
    ,   cast(enc.class_code as {{ dbt.type_string() }} )                                        as class_code
    ,   cast(enc.class_display as {{ dbt.type_string() }} )                                     as class_description
    ,   cast(enc.status as {{ dbt.type_string() }} )                                            as status
    ,   {{ try_to_cast_date('enc.period_start', 'YYYY-MM-DD') }}                                as encounter_start_date
    ,   {{ try_to_cast_date('enc.period_end', 'YYYY-MM-DD') }}                                  as encounter_end_date
    ,   {{ 
            dbt.datediff(
                try_to_cast_date('enc.period_start', 'YYYY-MM-DD'),
                try_to_cast_date('enc.period_end', 'YYYY-MM-DD'),'day'
            ) 
        }}                                                                                      as length_of_stay
    ,   cast(hospitalization_dischargedisposition_coding_0_system as {{ dbt.type_string() }} )  as discharge_disposition_code_type
    ,   cast(hospitalization_dischargedisposition_coding_0_code as {{ dbt.type_string() }} )    as discharge_disposition_code
    ,   cast(hospitalization_dischargedisposition_coding_0_display as {{ dbt.type_string() }} ) as discharge_disposition_description
    ,   cast(right(enc.participant_0_individual_reference, 36) as {{ dbt.type_string() }} )     as practitioner_id
    ,   cast(right(enc.location_0_location_reference, 36) as {{ dbt.type_string() }} )          as facility_id
    ,   cast(right(enc.serviceprovider_reference, 36) as {{ dbt.type_string() }} )              as organization_id
    ,   cast(enc.meta_source as {{ dbt.type_string() }} )                                       as data_source
from {{ ref('stage__encounter') }} as enc
left join {{ref('stage__patient') }} p
    on right(enc.subject_reference, 36) = p.id
