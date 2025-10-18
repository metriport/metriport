with codings as (
    {{ get_procedcure_codings('stage__procedure', 7) }}
),
codings_with_static_rank as (
    select 
            procedure_id
        ,   code
        ,   system
        ,   display
        ,   case 
                when system = 'cpt' then 0
                when system = 'loinc' then 1
                when system = 'snomed-ct' then 2
                when system = 'cdt' then 3
                when system = 'hcpcs' then 4
                when system = 'epic' then 5
                else 6
            end as static_rank
    from codings
),
codings_with_relative_rank as (
    select
            procedure_id
        ,   code
        ,   system
        ,   display
        ,   row_number() over(partition by procedure_id order by static_rank) as relative_rank
    from codings_with_static_rank
),
target_coding as (
    select
        *
    from codings_with_relative_rank
    where relative_rank = 1
)
select
        cast(pro.id as {{ dbt.type_string() }} )                                                                    as procedure_id
    ,   cast(pat.id as {{ dbt.type_string() }} )                                                                    as patient_id
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as encounter_id
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as claim_id
    ,   coalesce(
            {{ try_to_cast_date('pro.performeddatetime') }},
            {{ try_to_cast_date('pro.performedperiod_start') }}
        )                                                                                                           as procedure_date
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                                 as source_code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                                   as source_code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                            as source_description
    ,   cast(
            case
                when tc.system = 'cpt' then 'cpt'
                when loinc.loinc is not null then 'loinc'
                when snomed.snomed_ct is not null then 'snomed-ct'
                when tc.system = 'cdt' then 'cdt'
                when tc.system = 'hcpcs' then 'hcpcs'
                when tc.system = 'epic' then 'epic'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                           as normalized_code_type
    ,   cast(
            coalesce(
                case 
                    when tc.system = 'cpt' and hcpcs.hcpcs is not null then hcpcs.hcpcs 
                    else null 
                end,
                case when tc.system = 'cpt' then tc.code else null end,
                loinc.loinc,
                snomed.snomed_ct,
                case when tc.system = 'cdt' then tc.code else null end,
                case 
                    when tc.system = 'hcpcs' and hcpcs.hcpcs is not null then hcpcs.hcpcs 
                    else null
                end,
                case when tc.system = 'hcpcs' then tc.code else null end,
                case when tc.system = 'epic' then tc.code else null end
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as normalized_code
    ,   cast(
            coalesce(
                case 
                    when tc.system = 'cpt' and hcpcs.long_description is not null then hcpcs.long_description 
                    else null 
                end,
                case when tc.system = 'cpt' then tc.display else null end,
                loinc.long_common_name,
                snomed.description,
                case when tc.system = 'cdt' then tc.display else null end,
                case 
                    when tc.system = 'hcpcs' and hcpcs.long_description is not null then hcpcs.long_description 
                    else null
                end,
                case when tc.system = 'hcpcs' then tc.display else null end,
                case when tc.system = 'epic' then tc.display else null end
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as normalized_description
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as modifier_1
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as modifier_2
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as modifier_3
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as modifier_4
    ,   cast(null as {{ dbt.type_string() }} )                                                                      as modifier_5
    ,   cast(pro.status as {{ dbt.type_string() }} )                                                                as status
    ,   cast(right(pro.performer_0_actor_reference, 36) as {{ dbt.type_string() }} )                                as practitioner_id
    ,   cast(pro.meta_source as {{ dbt.type_string() }} )                                                           as data_source
from {{ ref('stage__procedure' ) }} pro
left join {{ref('stage__patient')}} pat
    on right(pro.subject_reference, 36) = pat.id
left join target_coding tc
    on pro.id = tc.procedure_id
left join {{ref('terminology__hcpcs_level_2')}} hcpcs
    on tc.system in ('cpt', 'hcpcs') and tc.code = hcpcs.hcpcs
left join {{ref('terminology__loinc')}} loinc
    on tc.system = 'loinc' and tc.code = loinc.loinc
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
