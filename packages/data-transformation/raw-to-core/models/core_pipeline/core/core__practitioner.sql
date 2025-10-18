select
      cast(id as {{ dbt.type_string() }} )                                    as practitioner_id
    , cast(name_0_given_0 as {{ dbt.type_string() }} )                        as first_name
    , cast(name_0_family as {{ dbt.type_string() }} )                         as last_name
    , cast(
        coalesce(
          qualification_0_code_coding_0_display,
          qualification_0_code_coding_1_display,
          qualification_0_code_coding_2_display,
          qualification_0_code_text,
          qualification_1_code_coding_0_display,
          qualification_1_code_coding_1_display,
          qualification_1_code_coding_2_display,
          qualification_1_code_text,
          qualification_2_code_coding_0_display,
          qualification_2_code_coding_1_display,
          qualification_2_code_coding_2_display,
          qualification_2_code_text
        ) as {{ dbt.type_string() }} 
      )                                                                       as specialty
    , cast(meta_source as {{ dbt.type_string() }} )                           as data_source
from {{ref('stage__practitioner')}}
