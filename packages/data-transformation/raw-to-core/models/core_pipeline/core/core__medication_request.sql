select
        cast(mr.id as {{ dbt.type_string() }} )                                                     as medication_request_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(mr.status as {{ dbt.type_string() }} )                                                 as status
    ,   {{ try_to_cast_date('mr.authoredon') }}                                                     as request_date
    ,   cast(
            coalesce(
                mr.dosageinstruction_0_doseandrate_0_dosequantity_unit,
                mr.dosageinstruction_1_doseandrate_0_dosequantity_unit
            ) as {{ dbt.type_string() }} 
        )                                                                                           as dose_unit
    ,   cast(
            coalesce(
                mr.dosageinstruction_0_doseandrate_0_dosequantity_value,
                mr.dosageinstruction_1_doseandrate_0_dosequantity_value
            ) as {{ dbt.type_string() }} 
        )                                                                                           as dose_amount
    ,   cast(
            coalesce(
                mr.dosageinstruction_0_method_coding_0_display,
                mr.dosageinstruction_0_method_coding_1_display,
                mr.dosageinstruction_0_method_text,
                mr.dosageinstruction_1_method_coding_0_display,
                mr.dosageinstruction_1_method_coding_1_display,
                mr.dosageinstruction_1_method_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                mr.dosageinstruction_0_route_coding_0_display,
                mr.dosageinstruction_0_route_coding_1_display,
                mr.dosageinstruction_0_route_text,
                mr.dosageinstruction_1_route_coding_0_display,
                mr.dosageinstruction_1_route_coding_1_display,
                mr.dosageinstruction_1_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                mr.dosageinstruction_0_site_coding_0_display,
                mr.dosageinstruction_0_site_coding_1_display,
                mr.dosageinstruction_0_site_text,
                mr.dosageinstruction_1_site_coding_0_display,
                mr.dosageinstruction_1_site_coding_1_display,
                mr.dosageinstruction_1_site_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_site
    ,   cast(
            coalesce(
                mr.note_0_text,
                mr.note_1_text,
                mr.note_2_text,
                mr.note_3_text,
                mr.note_4_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(right(mr.requester_reference, 36) as {{ dbt.type_string() }} )                         as practitioner_id
    ,   cast(mr.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationrequest')}} as mr
inner join {{ref('stage__medication')}} as m
    on right(mr.medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(mr.subject_reference, 36) = p.id
