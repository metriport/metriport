select
        cast(observation_id as {{ dbt.type_string() }})                                     as observation_id
    ,   cast(patient_id as {{ dbt.type_string() }} )                                        as patient_id
    ,   cast(null as {{ dbt.type_string() }} )                                              as encounter_id
    ,   cast(null as {{ dbt.type_string() }} )                                              as panel_id
    ,   {{ try_to_cast_date('observation_date') }}                                          as observation_date
    ,   cast(category as {{ dbt.type_string() }} )                                          as observation_type
    ,   cast(code_type as {{ dbt.type_string() }} )                                         as source_code_type
    ,   cast(code as {{ dbt.type_string() }} )                                              as source_code
    ,   cast(description as {{ dbt.type_string() }} )                                       as source_description
    ,   cast(
            case
                when loinc_code is not null then 'loinc'
                when snomed_code is not null then 'snomed'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                   as normalized_code_type
    ,   cast(
            coalesce(
                loinc_code, 
                snomed_code
            ) as {{ dbt.type_string() }} 
        )                                                                                   as normalized_code
    ,   cast(
            coalesce(
                loinc_description, 
                snomed_description
            ) as {{ dbt.type_string() }} 
        )                                                                                   as normalized_description
    ,   cast(status as {{ dbt.type_string() }} )                                            as status
    ,   cast(result as {{ dbt.type_string() }} )                                            as result
    ,   cast(source_units as {{ dbt.type_string() }} )                                      as source_units
    ,   cast(null as {{ dbt.type_string() }} )                                              as normalized_units
    ,   cast(source_reference_range_low as {{ dbt.type_string() }} )                        as source_reference_range_low
    ,   cast(source_reference_range_high as {{ dbt.type_string() }} )                       as source_reference_range_high
    ,   cast(null as {{ dbt.type_string() }} )                                              as normalized_reference_range_low
    ,   cast(null as {{ dbt.type_string() }} )                                              as normalized_reference_range_high
    ,   cast(null as {{ dbt.type_string() }} )                                              as source_abnormal_flag
    ,   cast(null as {{ dbt.type_string() }} )                                              as normalized_abnormal_flag
    ,   cast(data_source as {{ dbt.type_string() }} )                                    as data_source
from {{ref('intermediate__all_observations')}}
where category <> 'laboratory'
