
select
      cast(id as {{ dbt.type_string() }}) as lab_result_id
    , cast(patient_id as {{ dbt.type_string() }} ) as patient_id
    , cast(null as {{ dbt.type_string() }} ) as encounter_id
    , cast(null as {{ dbt.type_string() }} ) as accession_number
    , cast(code_type as {{ dbt.type_string() }} ) as source_code_type
    , cast(code as {{ dbt.type_string() }} ) as source_code
    , cast(description as {{ dbt.type_string() }} ) as source_description
    , cast(null as {{ dbt.type_string() }} ) as source_component
    , cast(case
            when loinc_code is not null then 'loinc'
            when snomed_code is not null then 'snomed'
            end as {{ dbt.type_string() }} ) as normalized_code_type
    , cast(coalesce(loinc_code, snomed_code) as {{ dbt.type_string() }} ) as normalized_code
    , cast(coalesce(loinc_description, snomed_description) as {{ dbt.type_string() }} ) as normalized_description
    , cast(null as {{ dbt.type_string() }} ) as normalized_component
    , cast(status as {{ dbt.type_string() }} ) as status
    , cast(result as {{ dbt.type_string() }} ) as result
    , cast(result_date as date) as result_date
    , cast(collection_date as date) as collection_date
    , cast(source_units as {{ dbt.type_string() }} ) as source_units
    , cast(null as {{ dbt.type_string() }} ) as normalized_units
    , cast(source_reference_range_low as {{ dbt.type_string() }} ) as source_reference_range_low
    , cast(source_reference_range_high as {{ dbt.type_string() }} ) as source_reference_range_high
    , cast(null as {{ dbt.type_string() }} ) as normalized_reference_range_low
    , cast(null as {{ dbt.type_string() }} ) as normalized_reference_range_high
--     , cast(source_abnormal_flag as {{ dbt.type_string() }} ) as source_abnormal_flag
    , cast(null as {{ dbt.type_string() }} ) as source_abnormal_flag
    , cast(null as {{ dbt.type_string() }} ) as normalized_abnormal_flag
    , cast(null as {{ dbt.type_string() }} ) as specimen
    , cast(null as {{ dbt.type_string() }} ) as ordering_practitioner_id
    , cast(data_source as {{ dbt.type_string() }} ) as data_source
from {{ref('int__all_observations')}} ao
where category = 'laboratory'


