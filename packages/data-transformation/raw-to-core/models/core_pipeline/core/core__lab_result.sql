select
        cast(observation_id as {{ dbt.type_string() }})                                     as lab_result_id
    ,   cast(patient_id as {{ dbt.type_string() }} )                                        as patient_id
    ,   cast(status as {{ dbt.type_string() }} )                                            as status
    ,   {{ try_to_cast_date('result_date') }}                                               as result_date
    ,   {{ try_to_cast_date('collection_date') }}                                           as collection_date
    ,   cast(source_code_type as {{ dbt.type_string() }} )                                  as source_code_type
    ,   cast(source_code as {{ dbt.type_string() }} )                                       as source_code
    ,   cast(source_description as {{ dbt.type_string() }} )                                as source_description
    ,   cast(normalized_code_type as {{ dbt.type_string() }} )                              as normalized_code_type
    ,   cast(normalized_code as {{ dbt.type_string() }} )                                   as normalized_code
    ,   cast(normalized_description as {{ dbt.type_string() }} )                            as normalized_description
    ,   cast(result as {{ dbt.type_string() }} )                                            as result
    ,   cast(source_units as {{ dbt.type_string() }} )                                      as source_units
    ,   cast(source_reference_range_low as {{ dbt.type_string() }} )                        as source_reference_range_low
    ,   cast(source_reference_range_high as {{ dbt.type_string() }} )                       as source_reference_range_high
    ,   cast(category_code_type as {{ dbt.type_string() }} )                                as category_code_type
    ,   cast(category_code as {{ dbt.type_string() }} )                                     as category_code
    ,   cast(category_description as {{ dbt.type_string() }} )                              as category_description
    ,   cast(interpretation_code_type as {{ dbt.type_string() }} )                          as interpretation_code_type
    ,   cast(interpretation_code as {{ dbt.type_string() }} )                               as interpretation_code
    ,   cast(interpretation_description as {{ dbt.type_string() }} )                        as interpretation_description
    ,   cast(practitioner_id as {{ dbt.type_string() }} )                                   as practitioner_id
    ,   cast(data_source as {{ dbt.type_string() }} )                                       as data_source
from {{ref('intermediate__all_observations')}}
where category = 'laboratory'
