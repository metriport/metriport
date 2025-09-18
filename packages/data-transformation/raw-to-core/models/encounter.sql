select
      enc.id as encounter_id
    , cast(right(enc.subject_reference, 36) as {{ dbt.type_string() }} ) as patient_id
    , coalesce(etm.tuva_type, 'other') as encounter_type
    , {{ try_to_cast_date('enc.period_start', 'YYYY-MM-DD') }}  as encounter_start_date
    , {{ try_to_cast_date('enc.period_end', 'YYYY-MM-DD') }}    as encounter_end_date
    , {{ dbt.datediff(
            try_to_cast_date('enc.period_start', 'YYYY-MM-DD'),
            try_to_cast_date('enc.period_end', 'YYYY-MM-DD'),'day'
        ) }}                                  as length_of_stay
    , cast(null  as {{ dbt.type_string() }} ) as admit_source_code
    , cast(null  as {{ dbt.type_string() }} ) as admit_source_description
    , cast(null  as {{ dbt.type_string() }} ) as admit_type_code
    , cast(null  as {{ dbt.type_string() }} ) as admit_type_description
    , cast(null  as {{ dbt.type_string() }} ) as discharge_disposition_code
    , cast(null  as {{ dbt.type_string() }} ) as discharge_disposition_description
    , try_cast(coalesce(
                enc.participant_0_individual_reference, 
                enc.participant_1_individual_reference
            )  as {{ dbt.type_string() }} )   as attending_provider_id
    , cast(null  as {{ dbt.type_string() }} ) as facility_npi
    , cast(null  as {{ dbt.type_string() }} ) as primary_diagnosis_code_type 
    , cast(null  as {{ dbt.type_string() }} ) as primary_diagnosis_code
    , cast(null  as {{ dbt.type_string() }} ) as primary_diagnosis_description
    , cast(null  as {{ dbt.type_string() }} ) as ms_drg_code
    , cast(null  as {{ dbt.type_string() }} ) as ms_drg_description
    , cast(null  as {{ dbt.type_string() }} ) as apr_drg_code
    , cast(null  as {{ dbt.type_string() }} ) as apr_drg_description
    , cast(null  as {{ dbt.type_string() }} ) as paid_amount
    , cast(null  as {{ dbt.type_string() }} ) as allowed_amount
    , cast(null  as {{ dbt.type_string() }} ) as charge_amount
     , 'metriport' as data_source
from {{ ref('stage__encounter') }} as enc
left join {{ref('encounter_type_map')}} etm
    on enc.type_0_text = etm.hg_type
