with target_category_coding as (
    {{ 
        get_target_coding(
            get_medication_statement_category_codings, 
            'stage__medicationstatement', 
            'medication_statement_id', 
            1, 
            2, 
            medication_statement_category_code_system
        ) }}
)
select
        cast(id as {{ dbt.type_string() }} )                                                        as medication_statement_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(status as {{ dbt.type_string() }} )                                                    as status
    ,   coalesce(
            {{ try_to_cast_date('effectivedatetime') }},
            {{ try_to_cast_date('effectiveperiod_start') }}
        )                                                                                           as statement_date
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                             as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                               as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                            as category_description
    ,   cast(
            coalesce(
                dosage_0_method_coding_0_display,
                dosage_0_method_coding_1_display,
                dosage_0_method_text,
                dosage_1_method_coding_0_display,
                dosage_1_method_coding_1_display,
                dosage_1_method_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                dosage_0_route_coding_0_display,
                dosage_0_route_coding_1_display,
                dosage_0_route_text,
                dosage_1_route_coding_0_display,
                dosage_1_route_coding_1_display,
                dosage_1_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                dosage_0_site_coding_0_display,
                dosage_0_site_coding_1_display,
                dosage_0_site_text,
                dosage_1_site_coding_0_display,
                dosage_1_site_coding_1_display,
                dosage_1_site_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_site
    ,   cast(
            coalesce(
                note_0_text,
                note_1_text,
                note_2_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(meta_source as {{ dbt.type_string() }} )                                               as data_source
from {{ref('stage__medicationstatement')}} as ms
inner join {{ref('stage__medication')}} as m
    on right(medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(ms.subject_reference, 36) = p.id
left join target_category_coding tc_cat
    on tc_cat.medication_statement_id = ms.id
