select
        cast(md.id as {{ dbt.type_string() }} )                                                     as medication_dispense_id
    ,   cast(right(md.subject_reference, 36)  as {{ dbt.type_string() }} )                          as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(md.status as {{ dbt.type_string() }} )                                                 as status
    ,   {{ try_to_cast_date('md.whenhandedover') }}                                                 as when_handed_over
    ,   {{ try_to_cast_date('md.whenprepared') }}                                                   as when_prepared
    ,   cast(
            coalesce(
                md.quantity_unit,
                md.dosageinstruction_0_doseandrate_0_dosequantity_unit,
                md.dosageinstruction_1_doseandrate_0_dosequantity_unit
            ) as {{ dbt.type_string() }} 
        )                                                                                           as dose_unit
    ,   cast(
            coalesce(
                md.quantity_value,
                md.dosageinstruction_0_doseandrate_0_dosequantity_value,
                md.dosageinstruction_1_doseandrate_0_dosequantity_value
            ) as {{ dbt.type_string() }} 
        )                                                                                           as dose_amount
    ,   cast(md.dayssupply_value as {{ dbt.type_string() }} )                                       as days_supply_amount
    ,   cast(md.dayssupply_unit as {{ dbt.type_string() }} )                                        as days_supply_unit
    ,   cast(
            coalesce(
                md.note_0_text,
                md.note_1_text,
                md.note_2_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(md.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationdispense')}} as md
inner join {{ref('stage__medication')}} as m
    on right(md.medicationreference_reference, 36) = m.id
