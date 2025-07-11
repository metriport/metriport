select
      cast(pract.id as {{ dbt.type_string() }} ) as practitioner_id
    , cast(null as {{ dbt.type_string() }} ) as npi
    , cast(pract.name_0_given_0 as {{ dbt.type_string() }} ) as first_name
    , cast(pract.name_0_family as {{ dbt.type_string() }} ) as last_name
    , cast(null as {{ dbt.type_string() }} ) as practice_affiliation
    , cast(pract.qualification_0_code_coding_0_display as {{ dbt.type_string() }} ) as specialty
    , cast(null as {{ dbt.type_string() }} ) as sub_specialty
    , cast(null as {{ dbt.type_string() }} ) as data_source
 from {{ ref('stage__practitioner') }} as pract