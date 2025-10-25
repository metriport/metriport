select
        cast(ms.id as {{ dbt.type_string() }} )                                                     as medication_statement_id
    ,   cast(right(ms.subject_reference, 36) as {{ dbt.type_string() }} )                           as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(ms.status as {{ dbt.type_string() }} )                                                 as status
    ,   coalesce(
            {{ try_to_cast_date('ms.effectivedatetime') }},
            {{ try_to_cast_date('ms.effectiveperiod_start') }}
        )                                                                                           as effective_date
    ,   {{ try_to_cast_date('ms.effectiveperiod_end') }}                                            as end_date
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
                ms.note_0_text,
                ms.note_1_text,
                ms.note_2_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(ms.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationstatement')}} as ms
inner join {{ref('stage__medication')}} as m
    on right(ms.medicationreference_reference, 36) = m.id
