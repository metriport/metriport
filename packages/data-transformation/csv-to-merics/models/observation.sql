   select
      cast(ao.id as {{ dbt.type_string() }} ) as observation_id
    , cast(ao.patient_id as {{ dbt.type_string() }} ) as patient_id
    , cast(null as {{ dbt.type_string() }} ) as encounter_id
    , cast(null as {{ dbt.type_string() }} ) as panel_id
    , cast(ao.observation_date as date) as observation_date
    , cast(ao.category as {{ dbt.type_string() }} ) as observation_type
    , cast(ao.code_type as {{ dbt.type_string() }} ) as source_code_type
    , cast(ao.code as {{ dbt.type_string() }} ) as source_code
    , cast(ao.description as {{ dbt.type_string() }} ) as source_description
    , cast(case
        when ao.loinc_code is not null then 'loinc'
        when ao.snomed_code is not null then 'snomed'
        end as {{ dbt.type_string() }} ) as normalized_code_type
    , cast(coalesce(ao.loinc_code, ao.snomed_code) as {{ dbt.type_string() }} ) as normalized_code
    , cast(coalesce(ao.loinc_description, ao.snomed_description) as {{ dbt.type_string() }} ) as normalized_description
    , cast(ao.result as {{ dbt.type_string() }} ) as result
    , cast(ao.source_units as {{ dbt.type_string() }} ) as source_units
    , cast(null as {{ dbt.type_string() }} ) as normalized_units
    , cast(ao.source_reference_range_low as {{ dbt.type_string() }} ) as source_reference_range_low
    , cast(ao.source_reference_range_high as {{ dbt.type_string() }} ) as source_reference_range_high
    , cast(null as {{ dbt.type_string() }} ) as normalized_reference_range_low
    , cast(null as {{ dbt.type_string() }} ) as normalized_reference_range_high
    , cast('metriport' as {{ dbt.type_string() }} ) as data_source
from {{ref('int__all_observations')}} ao
where category <> 'laboratory'
