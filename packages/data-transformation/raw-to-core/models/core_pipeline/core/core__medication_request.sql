with target_category_coding as (
    {{ 
        get_target_coding(
            get_medication_request_category_codings, 
            'stage__medicationrequest', 
            'medication_request_id', 
            1, 
            2, 
            medication_request_category_code_system
        ) }}
)
select
        cast(mr.id as {{ dbt.type_string() }} )                                                     as medication_request_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(status as {{ dbt.type_string() }} )                                                    as status
    ,   {{ try_to_cast_date('authoredon') }}                                                        as request_date
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                             as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                               as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                            as category_description
    ,   cast(
            coalesce(
                dosageinstruction_0_method_coding_0_display,
                dosageinstruction_0_method_coding_1_display,
                dosageinstruction_0_method_text,
                dosageinstruction_1_method_coding_0_display,
                dosageinstruction_1_method_coding_1_display,
                dosageinstruction_1_method_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                dosageinstruction_0_route_coding_0_display,
                dosageinstruction_0_route_coding_1_display,
                dosageinstruction_0_route_text,
                dosageinstruction_1_route_coding_0_display,
                dosageinstruction_1_route_coding_1_display,
                dosageinstruction_1_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                dosageinstruction_0_site_coding_0_display,
                dosageinstruction_0_site_coding_1_display,
                dosageinstruction_0_site_text,
                dosageinstruction_1_site_coding_0_display,
                dosageinstruction_1_site_coding_1_display,
                dosageinstruction_1_site_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_site    ,   cast(null as {{ dbt.type_int() }} )                                                         as days_supply
    ,   cast(
            coalesce(
                note_0_text,
                note_1_text,
                note_2_text,
                note_3_text,
                note_4_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(right(requester_reference, 36) as {{ dbt.type_string() }} )                            as practitioner_id
    ,   cast(meta_source as {{ dbt.type_string() }} )                                               as data_source
from {{ref('stage__medicationrequest')}} as mr
inner join {{ref('stage__medication')}} as m
    on right(medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(mr.subject_reference, 36) = p.id
left join target_category_coding tc_cat
    on tc_cat.medication_request_id = mr.id
