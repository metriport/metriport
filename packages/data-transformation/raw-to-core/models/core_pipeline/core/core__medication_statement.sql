with target_category_coding as (
    {{ 
        get_target_coding(
            get_medication_statement_category_codings, 
            'stage__medicationstatement', 
            'medication_statement_id', 
            1, 
            none, 
            medication_statement_category_code_system
        ) }}
),
target_reason_coding as (
    {{ 
        get_target_coding(
            get_medication_statement_reason_codings, 
            'stage__medicationstatement', 
            'medication_statement_id', 
            1, 
            1,
            medication_statement_reason_code_system
        ) 
    }}
)
select
        cast(ms.id as {{ dbt.type_string() }} )                                                     as medication_statement_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(ms.status as {{ dbt.type_string() }} )                                                 as status
    ,   coalesce(
            {{ try_to_cast_date('ms.effectivedatetime') }},
            {{ try_to_cast_date('ms.effectiveperiod_start') }}
        )                                                                                           as statement_date
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                             as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                               as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                            as category_description
    ,   cast(tc_reason.system as {{ dbt.type_string() }} )                                          as reason_code_type
    ,   cast(tc_reason.code as {{ dbt.type_string() }} )                                            as reason_code
    ,   cast(tc_reason.display as {{ dbt.type_string() }} )                                         as reason_description
    ,   cast(
            coalesce(
                ms.dosage_0_doseandrate_0_dosequantity_unit,
                ms.dosage_1_doseandrate_0_dosequantity_unit
            ) as {{ dbt.type_string() }} 
        )                                                                                           as dose_unit
    ,   cast(
            coalesce(
                ms.dosage_0_doseandrate_0_dosequantity_value,
                ms.dosage_1_doseandrate_0_dosequantity_value
            ) as {{ dbt.type_string() }} 
        )                                                                                           as dose_amount
    ,   cast(
            coalesce(
                ms.dosage_0_method_coding_0_display,
                ms.dosage_0_method_coding_1_display,
                ms.dosage_0_method_text,
                ms.dosage_1_method_coding_0_display,
                ms.dosage_1_method_coding_1_display,
                ms.dosage_1_method_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                ms.dosage_0_route_coding_0_display,
                ms.dosage_0_route_coding_1_display,
                ms.dosage_0_route_text,
                ms.dosage_1_route_coding_0_display,
                ms.dosage_1_route_coding_1_display,
                ms.dosage_1_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                ms.dosage_0_site_coding_0_display,
                ms.dosage_0_site_coding_1_display,
                ms.dosage_0_site_text,
                ms.dosage_1_site_coding_0_display,
                ms.dosage_1_site_coding_1_display,
                ms.dosage_1_site_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_site
    ,   cast(
            coalesce(
                ms.note_0_text,
                ms.note_1_text,
                ms.note_2_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(ms.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationstatement')}} as ms
inner join {{ref('stage__medication')}} as m
    on right(ms.medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(ms.subject_reference, 36) = p.id
left join target_category_coding tc_cat
    on tc_cat.medication_statement_id = ms.id
left join target_reason_coding tc_reason
    on tc_reason.medication_statement_id = ms.id
