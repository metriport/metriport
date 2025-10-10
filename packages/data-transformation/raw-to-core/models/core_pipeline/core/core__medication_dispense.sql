with target_category_coding as (
    {{ 
        get_target_coding(
            get_medication_dispense_category_codings, 
            'stage__medicationdispense', 
            'medication_dispense_id', 
            1, 
            2, 
            medication_dispense_category_code_system
        ) }}
),
target_type_coding as (
    {{ 
        get_target_coding(
            get_medication_dispense_type_codings, 
            'stage__medicationdispense', 
            'medication_dispense_id', 
            1, 
            2, 
            medication_dispense_type_code_system
        ) }}
)
select
        cast(md.id as {{ dbt.type_string() }} )                                                     as medication_dispense_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(status as {{ dbt.type_string() }} )                                                    as status
    ,   {{ try_to_cast_date('whenhandedover') }}                                                    as dispense_date
    ,   {{ try_to_cast_date('whenprepared') }}                                                      as prepared_date
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                             as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                               as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                            as category_description
    ,   cast(tc_type.system as {{ dbt.type_string() }} )                                            as type_code_type
    ,   cast(tc_type.code as {{ dbt.type_string() }} )                                              as type_code
    ,   cast(tc_type.display as {{ dbt.type_string() }} )                                           as type_description
    ,   cast(quantity_unit as {{ dbt.type_string() }} )                                             as dose_unit
    ,   cast(quantity_value as {{ dbt.type_string() }} )                                            as dose_amount
    ,   cast(dayssupply_value as {{ dbt.type_int() }} )                                             as days_supply
    ,   cast(dayssupply_unit as {{ dbt.type_string() }} )                                           as days_supply_unit
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
        )                                                                                           as dosage_site
    ,   cast(
            coalesce(
                note_0_text,
                note_1_text,
                note_2_text,
                note_3_text,
                note_4_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(right(performer_0_actor_reference, 36) as {{ dbt.type_string() }} )                    as practitioner_id
    ,   cast(meta_source as {{ dbt.type_string() }} )                                               as data_source
from {{ref('stage__medicationdispense')}} as md
inner join {{ref('stage__medication')}} as m
    on right(medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(md.subject_reference, 36) = p.id
left join target_category_coding tc_cat
    on tc_cat.medication_dispense_id = md.id
left join target_type_coding tc_type
    on tc_type.medication_dispense_id = md.id
