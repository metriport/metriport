with target_coding as (
   {{   
        get_target_coding(
            get_observtaion_codings,
            'stage__observation', 
            'observation_id', 
            2, 
            none,
            observation_code_system
        ) 
    }}
),
target_category_coding as (
    {{ 
        get_target_coding(
            get_observation_category_codings, 
            'stage__observation', 
            'observation_id', 
            2, 
            0, 
            observation_code_system
        ) 
    }}
),
target_interpretation_coding as (
    {{ 
        get_target_coding(
            get_observation_interpretation_codings, 
            'stage__observation', 
            'observation_id', 
            0, 
            1,
            observation_code_system
        ) 
    }}
),
target_bodysite_coding as (
    {{ 
        get_target_coding(
            get_observation_bodysite_codings, 
            'stage__observation', 
            'observation_id', 
            2, 
            none,
            observation_bodysite_code_system
        ) 
    }}
)
select
        cast(obvs.id  as {{ dbt.type_string() }} )                                                          as observation_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                              as patient_id
    ,   cast(obvs.status as {{ dbt.type_string() }} )                                                       as status
    ,   coalesce(
            {{ try_to_cast_date('obvs.effectivedatetime') }}, 
            {{ try_to_cast_date('obvs.effectiveperiod_start') }} 
        )                                                                                                   as observation_date
    ,   coalesce(
            {{ try_to_cast_date('obvs.effectivedatetime') }}, 
            {{ try_to_cast_date('obvs.effectiveperiod_start') }} 
        )                                                                                                   as collection_date
    ,   coalesce(
            {{ try_to_cast_date('obvs.effectivedatetime') }}, 
            {{ try_to_cast_date('obvs.effectiveperiod_end') }} 
        )                                                                                                   as result_date
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                         as source_code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                           as source_code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                        as source_description
    ,   cast(
            case
                when loinc.loinc is not null then 'loinc'
                when snomed.snomed_ct is not null then 'snomed'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_code_type
    ,   cast(
            coalesce(
                loinc.loinc, 
                snomed.snomed_ct
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_code
    ,   cast(
            coalesce(
                loinc.long_common_name, 
                snomed.description
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_description
    ,   cast(
            coalesce(
                obvs.valuequantity_value, 
                obvs.valuestring, 
                obvs.valuecodeableconcept_text,
                obvs.valuecodeableconcept_coding_0_display,
                obvs.valuecodeableconcept_coding_1_display,
                obvs.valuecodeableconcept_coding_2_display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as result
    ,   cast(
            coalesce(
                obvs.valuequantity_unit, 
                obvs.referencerange_0_high_unit,
                obvs.referencerange_0_low_unit,
                obvs.referencerange_1_high_unit,
                obvs.referencerange_1_low_unit
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as source_units
    ,   cast(
            coalesce(
                obvs.referencerange_0_low_value,
                obvs.referencerange_1_low_value
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as source_reference_range_low
    ,   cast(
            coalesce(
                obvs.referencerange_0_high_value,
                obvs.referencerange_1_high_value
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as source_reference_range_high
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                                     as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                                       as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                                    as category_description
    ,   cast(tc_int.system as {{ dbt.type_string() }} )                                                     as interpretation_code_type
    ,   cast(tc_int.code as {{ dbt.type_string() }} )                                                       as interpretation_code
    ,   cast(tc_int.display as {{ dbt.type_string() }} )                                                    as interpretation_description
    ,   cast(tc_bs.system as {{ dbt.type_string() }} )                                                      as bodysite_code_type
    ,   cast(tc_bs.code as {{ dbt.type_string() }} )                                                        as bodysite_code
    ,   cast(tc_bs.display as {{ dbt.type_string() }} )                                                     as bodysite_description
    ,   cast(
            coalesce(
                obvs.note_0_text,
                obvs.note_1_text,
                obvs.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note
    ,   cast(right(obvs.performer_0_reference, 36) as {{ dbt.type_string() }} )                             as practitioner_id
    ,   cast(obvs.meta_source as {{ dbt.type_string() }} )                                                  as data_source
from {{ref('stage__observation')}} obvs
left join {{ref('stage__patient')}} p
    on right(obvs.subject_reference, 36) = p.id
left join target_coding tc
    on obvs.id = tc.observation_id
left join target_category_coding tc_cat
    on obvs.id = tc_cat.observation_id
left join target_interpretation_coding tc_int
    on obvs.id = tc_int.observation_id
left join target_bodysite_coding tc_bs
    on obvs.id = tc_bs.observation_id
left join {{ref('terminology__loinc')}} loinc
    on tc.system = 'loinc' and tc.code = loinc.loinc
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
