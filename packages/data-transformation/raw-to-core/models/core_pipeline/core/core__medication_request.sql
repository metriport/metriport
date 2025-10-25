select
        cast(mr.id as {{ dbt.type_string() }} )                                                     as medication_request_id
    ,   cast(right(mr.subject_reference, 36) as {{ dbt.type_string() }} )                           as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(mr.status as {{ dbt.type_string() }} )                                                 as status
    ,   {{ try_to_cast_date('mr.authoredon') }}                                                     as authored_on
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
                mr.note_0_text,
                mr.note_1_text,
                mr.note_2_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text    
    ,   cast(mr.intent as {{ dbt.type_string() }} )                                                 as intent
    ,   cast(mr.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationrequest')}} as mr
inner join {{ref('stage__medication')}} as m
    on right(mr.medicationreference_reference, 36) = m.id
