select
        cast(md.id as {{ dbt.type_string() }} )                                                     as medication_dispense_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
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
    ,   cast(md.dayssupply_value as {{ dbt.type_string() }} )                                       as days_supply
    ,   cast(md.dayssupply_unit as {{ dbt.type_string() }} )                                        as days_supply_unit
    ,   cast(
            coalesce(
                md.dosageinstruction_0_method_coding_0_display,
                md.dosageinstruction_0_method_coding_1_display,
                md.dosageinstruction_0_method_text,
                md.dosageinstruction_1_method_coding_0_display,
                md.dosageinstruction_1_method_coding_1_display,
                md.dosageinstruction_1_method_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                md.dosageinstruction_0_route_coding_0_display,
                md.dosageinstruction_0_route_coding_1_display,
                md.dosageinstruction_0_route_text,
                md.dosageinstruction_1_route_coding_0_display,
                md.dosageinstruction_1_route_coding_1_display,
                md.dosageinstruction_1_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                md.dosageinstruction_0_site_coding_0_display,
                md.dosageinstruction_0_site_coding_1_display,
                md.dosageinstruction_0_site_text,
                md.dosageinstruction_1_site_coding_0_display,
                md.dosageinstruction_1_site_coding_1_display,
                md.dosageinstruction_1_site_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_site
    ,   cast(
            coalesce(
                md.note_0_text,
                md.note_1_text,
                md.note_2_text,
                md.note_3_text,
                md.note_4_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(
            case 
                when md.performer_0_actor_reference ilike '%practitioner%' 
                    then right(md.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                           as performer_practitioner_id
    ,   cast(
            case 
                when md.performer_0_actor_reference ilike '%organization%' 
                    then right(md.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                           as performer_organization_id
    ,   cast(right(md.location_reference, 36) as {{ dbt.type_string() }} )                          as location_id
    ,   cast(md.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationdispense')}} as md
inner join {{ref('stage__medication')}} as m
    on right(md.medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(md.subject_reference, 36) = p.id
