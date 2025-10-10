with target_category_coding as (
    {{ 
        get_target_coding(
            get_medication_administration_category_codings, 
            'stage__medicationadministration', 
            'medication_administration_id', 
            1, 
            2, 
            medication_administration_category_code_system
        ) }}
)
select
        cast(ma.id as {{ dbt.type_string() }} )                                                     as medication_administration_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(status as {{ dbt.type_string() }} )                                                    as status
    ,   coalesce(
            {{ try_to_cast_date('effectivedatetime') }},
            {{ try_to_cast_date('effectiveperiod_start') }}
        )                                                                                           as administration_date
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                             as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                               as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                            as category_description
    ,   cast(dosage_dose_unit as {{ dbt.type_string() }} )                                          as dose_unit
    ,   cast(dosage_dose_value as {{ dbt.type_string() }} )                                         as dose_amount
    ,   cast(
            coalesce(
                dosage_method_coding_0_display,
                dosage_method_coding_1_display,
                dosage_method_text,
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                dosage_route_coding_0_display,
                dosage_route_coding_1_display,
                dosage_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                dosage_site_coding_0_display,
                dosage_site_coding_1_display,
                dosage_site_text
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
from {{ref('stage__medicationadministration')}} as ma
inner join {{ref('stage__medication')}} as m
    on right(medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(ma.patient_reference, 36) = p.id
left join target_category_coding tc_cat
    on tc_cat.medication_administration_id = ma.id
