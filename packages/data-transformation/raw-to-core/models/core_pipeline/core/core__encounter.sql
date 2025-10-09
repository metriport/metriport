select
        cast(enc.id as {{ dbt.type_string() }} )                                                as encounter_id      
    ,   cast(p.id as {{ dbt.type_string() }} )                                                  as patient_id
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as encounter_type
    ,   enc.class_display                                                                       as class
    ,   enc.status                                                                              as status
    ,   {{ try_to_cast_date('enc.period_start', 'YYYY-MM-DD') }}                                as encounter_start_date
    ,   {{ try_to_cast_date('enc.period_end', 'YYYY-MM-DD') }}                                  as encounter_end_date
    ,   {{ 
            dbt.datediff(
                try_to_cast_date('enc.period_start', 'YYYY-MM-DD'),
                try_to_cast_date('enc.period_end', 'YYYY-MM-DD'),'day'
            ) 
        }}                                                                                      as length_of_stay
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as admit_source_code
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as admit_source_description
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as admit_type_code
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as admit_type_description
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as discharge_disposition_code
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as discharge_disposition_description
    ,   cast(right(enc.participant_0_individual_reference, 36) as {{ dbt.type_string() }} )     as attending_provider_id
    ,   cast(right(enc.location_0_location_reference, 36) as {{ dbt.type_string() }} )          as facility_id
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as facility_npi
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as primary_diagnosis_code_type 
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as primary_diagnosis_code
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as primary_diagnosis_description
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as ms_drg_code
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as ms_drg_description
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as apr_drg_code
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as apr_drg_description
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as paid_amount
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as allowed_amount
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as charge_amount
    ,   cast(null  as {{ dbt.type_string() }} )                                                 as claim_count
    ,   cast(enc.meta_source as {{ dbt.type_string() }} )                                       as data_source
from {{ ref('stage__encounter') }} as enc
left join {{ref('stage__patient') }} p
    on right(enc.subject_reference, 36) = p.id
