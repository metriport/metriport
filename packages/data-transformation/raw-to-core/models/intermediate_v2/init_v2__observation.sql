with codings as (
    {{ get_observtaion_codings('stage__observation', 2) }}
),
codings_with_static_rank as (
    select 
            observation_id
        ,   code
        ,   system
        ,   display
        ,   case 
                when system = 'loinc' then 0
                when system = 'snomed-ct' then 1
                when system = 'cpt' then 2
                when system = 'usoncology' then 3
                when system = 'actcode' then  4
                when system = 'usva' then 5
                when system = 'icf' then 6
                when system = 'centricity' then 7
                when system = 'epic' then 8
                else 9
            end as static_rank
    from codings
),
codings_with_relative_rank as (
    select
            observation_id
        ,   code
        ,   system
        ,   display
        ,   row_number() over(partition by observation_id order by static_rank) as relative_rank
    from codings_with_static_rank
),
target_coding as (
    select
        *
    from codings_with_relative_rank
    where relative_rank = 1
)
select
        cast(obvs.id  as {{ dbt.type_string() }} )                                                          as observation_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                              as patient_id
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                         as code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                           as code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                        as description
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
    ,   cast(
            coalesce(
                obvs.valuequantity_value, 
                obvs.valuestring, 
                obvs.valuecodeableconcept_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as result
    ,   cast(obvs.valuequantity_unit as {{ dbt.type_string() }} )                                           as source_units
    ,   cast(obvs.referencerange_0_low_value as {{ dbt.type_string() }} )                                   as source_reference_range_low
    ,   cast(obvs.referencerange_0_high_value as {{ dbt.type_string() }} )                                  as source_reference_range_high
    ,   cast(obvs.interpretation_0_coding_0_display as {{ dbt.type_string() }})                             as source_abnormal_flag
    ,   cast(obvs.category_0_coding_0_code as {{ dbt.type_string() }})                                      as category
    ,   loinc.loinc                                                                                         as loinc_code
    ,   loinc.long_common_name                                                                              as loinc_description
    ,   snomed.snomed_ct                                                                                    as snomed_code
    ,   snomed.description                                                                                  as snomed_description
    ,   cast(obvs.meta_source as {{ dbt.type_string() }} )                                                  as data_source
from {{ref('stage__observation')}} obvs
left join {{ref('stage__patient')}} p
    on right(obvs.subject_reference, 36) = p.id
left join target_coding tc
    on obvs.id = tc.observation_id
left join {{ref('terminology__loinc')}} loinc
    on tc.system = 'loinc' and tc.code = loinc.loinc
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
