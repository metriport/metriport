select
        cast(ma.id as {{ dbt.type_string() }} )                                                     as medication_administration_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                      as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(ma.status as {{ dbt.type_string() }} )                                                 as status
    ,   coalesce(
            {{ try_to_cast_date('ma.effectivedatetime') }},
            {{ try_to_cast_date('ma.effectiveperiod_start') }}
        )                                                                                           as start_date
    ,   {{ try_to_cast_date('ma.effectiveperiod_end') }}                                            as end_date
    ,   cast(ma.dosage_dose_unit as {{ dbt.type_string() }} )                                       as dose_unit
    ,   cast(ma.dosage_dose_value as {{ dbt.type_string() }} )                                      as dose_amount
    ,   cast(
            coalesce(
                ma.dosage_method_coding_0_display,
                ma.dosage_method_coding_1_display,
                ma.dosage_method_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_method
    ,   cast(
            coalesce(
                ma.dosage_route_coding_0_display,
                ma.dosage_route_coding_1_display,
                ma.dosage_route_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_route
    ,   cast(
            coalesce(
                ma.dosage_site_coding_0_display,
                ma.dosage_site_coding_1_display,
                ma.dosage_site_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as dosage_site
    ,   cast(
            coalesce(
                ma.note_0_text,
                ma.note_1_text,
                ma.note_2_text,
                ma.note_3_text,
                ma.note_4_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(
            case 
                when ma.performer_0_actor_reference ilike '%practitioner%' 
                    then right(ma.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                           as performer_practitioner_id
    ,   cast(
            case 
                when ma.performer_0_actor_reference ilike '%organization%' 
                    then right(ma.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                           as performer_organization_id
    ,   cast(ma.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationadministration')}} as ma
inner join {{ref('stage__medication')}} as m
    on right(ma.medicationreference_reference, 36) = m.id
left join {{ref('stage__patient')}} p
    on right(ma.subject_reference, 36) = p.id
