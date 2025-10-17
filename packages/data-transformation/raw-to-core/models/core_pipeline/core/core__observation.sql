with target_code_codings as (
   {{   
        get_target_codings(
            get_observtaion_codings,
            'observation_id', 
            2, 
            none,
            (
                'http://loinc.org',
                'http://snomed.info/sct'
            )
        ) 
    }}
),
target_category_codings as (
    {{ 
        get_target_codings(
            get_observation_category_codings, 
            'observation_id', 
            2, 
            0, 
            (
                'http://terminology.hl7.org/CodeSystem/observation-category',
            )
        ) 
    }}
),
target_interpretation_codings as (
    {{ 
        get_target_codings(
            get_observation_interpretation_codings, 
            'observation_id', 
            0, 
            1,
            (
                'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            )
        ) 
    }}
),
target_bodysite_codings as (
    {{ 
        get_target_codings(
            get_observation_bodysite_codings, 
            'observation_id', 
            2, 
            none,
            [
                'http://snomed.info/sct'
            ]
        ) 
    }}
)
select
        cast(obvs.id  as {{ dbt.type_string() }} )                                                          as observation_id
    ,   cast(right(obvs.subject_reference, 36)as {{ dbt.type_string() }} )                                  as patient_id
    ,   cast(obvs.status as {{ dbt.type_string() }} )                                                       as status
    ,   coalesce(
            {{ try_to_cast_date('obvs.effectivedatetime') }}, 
            {{ try_to_cast_date('obvs.effectiveperiod_start') }} 
        )                                                                                                   as start_date
    ,   {{ try_to_cast_date('obvs.effectiveperiod_end') }}                                                  as end_date
    ,   cast(
            coalesce(
                loinc.loinc,
                tc_loinc.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as loinc_code
    ,   cast(
            coalesce(
                loinc.long_common_name, 
                tc_loinc.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as loinc_display
    ,   cast(
            coalesce(
                snomed.snomed_ct,
                tc_snomed_ct.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as snomed_code
    ,   cast(
            coalesce(
                snomed.description,
                tc_snomed_ct.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as snomed_display
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
        )                                                                                                   as units
    ,   cast(
            coalesce(
                obvs.referencerange_0_low_value,
                obvs.referencerange_1_low_value
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as reference_range_low
    ,   cast(
            coalesce(
                obvs.referencerange_0_high_value,
                obvs.referencerange_1_high_value
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as reference_range_high
    ,   cast(category_hl7.code as {{ dbt.type_string() }} )                                                 as category_hl7_code
    ,   cast(category_hl7.display as {{ dbt.type_string() }} )                                              as category_hl7_display
    ,   cast(interpretation_hl7.code as {{ dbt.type_string() }} )                                           as interpretation_hl7_code
    ,   cast(interpretation_hl7.display as {{ dbt.type_string() }} )                                        as interpretation_hl7_display
    ,   cast(bodysite_snomed_ct.code as {{ dbt.type_string() }} )                                           as bodysite_snomed_ct_code
    ,   cast(bodysite_snomed_ct.display as {{ dbt.type_string() }} )                                        as bodysite_snomed_ct_display
    ,   cast(
            coalesce(
                obvs.note_0_text,
                obvs.note_1_text,
                obvs.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note_text
    ,   cast(
            case 
                when obvs.performer_0_reference ilike '%practitioner%' then right(obvs.performer_0_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                   as performer_practitioner_id
    ,   cast(
            case 
                when obvs.performer_0_reference ilike '%organization%' then right(obvs.performer_0_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                   as performer_organization_id
    ,   cast(obvs.meta_source as {{ dbt.type_string() }} )                                                  as data_source
from {{ref('stage__observation')}} obvs
left join target_code_codings tc_loinc
    on obvs.id = tc_loinc.observation_id 
        and tc_loinc.system = 'http://loinc.org'
left join target_code_codings tc_snomed_ct
    on obvs.id = tc_snomed_ct.observation_id 
        and tc_snomed_ct.system = 'http://snomed.info/sct'
left join target_category_codings category_hl7
    on obvs.id = category_hl7.observation_id 
        and category_hl7.system = 'http://terminology.hl7.org/CodeSystem/observation-category'
left join target_interpretation_codings interpretation_hl7
    on obvs.id = interpretation_hl7.observation_id 
        and interpretation_hl7.system = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
left join target_bodysite_codings bodysite_snomed_ct
    on obvs.id = bodysite_snomed_ct.observation_id 
        and bodysite_snomed_ct.system = 'http://snomed.info/sct'
left join {{ref('terminology__loinc')}} loinc
    on tc_loinc.code = loinc.loinc
left join {{ref('terminology__snomed_ct')}} snomed
    on tc_snomed_ct.code = snomed.snomed_ct
