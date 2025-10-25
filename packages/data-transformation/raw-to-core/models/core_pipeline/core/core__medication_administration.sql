select
        cast(ma.id as {{ dbt.type_string() }} )                                                     as medication_administration_id
    ,   cast(right(ma.subject_reference, 36) as {{ dbt.type_string() }} )                           as patient_id
    ,   cast(m.id as {{ dbt.type_string() }} )                                                      as medication_id
    ,   cast(ma.status as {{ dbt.type_string() }} )                                                 as status
    ,   coalesce(
            {{ try_to_cast_date('ma.effectivedatetime') }},
            {{ try_to_cast_date('ma.effectiveperiod_start') }}
        )                                                                                           as effective_date
    ,   {{ try_to_cast_date('ma.effectiveperiod_end') }}                                            as end_date
    ,   cast(ma.dosage_dose_unit as {{ dbt.type_string() }} )                                       as dose_unit
    ,   cast(ma.dosage_dose_value as {{ dbt.type_string() }} )                                      as dose_amount
    ,   cast(
            coalesce(
                ma.note_0_text,
                ma.note_1_text,
                ma.note_2_text
            ) as {{ dbt.type_string() }}
        )                                                                                           as note_text
    ,   cast(ma.meta_source as {{ dbt.type_string() }} )                                            as data_source
from {{ref('stage__medicationadministration')}} as ma
inner join {{ref('stage__medication')}} as m
    on right(ma.medicationreference_reference, 36) = m.id
