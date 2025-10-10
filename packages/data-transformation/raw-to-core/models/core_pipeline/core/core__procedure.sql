with target_coding as (
   {{   
        get_target_coding(
            get_procedcure_codings,
            'stage__procedure', 
            'procedure_id', 
            7, 
            none, 
            procedure_code_system
        ) 
    }}
),
target_bodysite_coding as (
    {{ 
        get_target_coding(
            get_procedcure_bodysite_codings, 
            'stage__procedure', 
            'procedure_id', 
            1, 
            2, 
            procedure_code_system
        ) }}
),
target_reason_coding as (
    {{ 
        get_target_coding(
            get_procedcure_reason_codings, 
            'stage__procedure', 
            'procedure_id', 
            9, 
            0,
            procedure_code_system
        ) 
    }}
)
select
        cast(pro.id as {{ dbt.type_string() }} )                                                                    as procedure_id
    ,   cast(pat.id as {{ dbt.type_string() }} )                                                                    as patient_id
    ,   cast(pro.status as {{ dbt.type_string() }} )                                                                as status
    ,   coalesce(
            {{ try_to_cast_date('pro.performeddatetime', 'YYYY-MM-DD') }},
            {{ try_to_cast_date('pro.performedperiod_start', 'YYYY-MM-DD') }}
        )                                                                                                           as procedure_date
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                                 as source_code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                                   as source_code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                                as source_description
    ,   cast(
            case
                when tc.system = 'cpt' and hcpcs.hcpcs is not null then 'cpt'
                when loinc.loinc is not null then 'loinc'
                when snomed.snomed_ct is not null then 'snomed-ct'
                when tc.system = 'hcpcs' and hcpcs.hcpcs is not null then 'hcpcs'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                           as normalized_code_type
    ,   cast(
            coalesce(
                hcpcs.hcpcs,
                loinc.loinc,
                snomed.snomed_ct
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as normalized_code
    ,   cast(
            coalesce(
                hcpcs.long_description,
                loinc.long_common_name,
                snomed.description
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as normalized_description
    ,   cast(note_0_text as {{ dbt.type_string() }} )                                                               as note
    ,   cast(note_0_time as {{ dbt.type_string() }} )                                                               as note_time
    ,   cast(tc_bs.system as {{ dbt.type_string() }} )                                                              as body_site_code_type
    ,   cast(tc_bs.code as {{ dbt.type_string() }} )                                                                as body_site_code
    ,   cast(tc_bs.display as {{ dbt.type_string() }} )                                                             as body_site_description
    ,   cast(tc_rc.system as {{ dbt.type_string() }} )                                                              as reason_code_type
    ,   cast(tc_rc.code as {{ dbt.type_string() }} )                                                                as reason_code
    ,   cast(tc_rc.display as {{ dbt.type_string() }} )                                                             as reason_description
    ,   cast(right(pro.performer_0_actor_reference, 36) as {{ dbt.type_string() }} )                                as practitioner_id
    ,   cast(pro.meta_source as {{ dbt.type_string() }} )                                                           as data_source
from {{ ref('stage__procedure' ) }} pro
left join {{ref('stage__patient')}} pat
    on right(pro.subject_reference, 36) = pat.id
left join target_coding tc
    on pro.id = tc.procedure_id
left join target_bodysite_coding tc_bs
    on pro.id = tc_bs.procedure_id
left join target_reason_coding tc_rc
    on pro.id = tc_rc.procedure_id
left join {{ref('terminology__hcpcs_level_2')}} hcpcs
    on tc.system in ('cpt', 'hcpcs') and tc.code = hcpcs.hcpcs
left join {{ref('terminology__loinc')}} loinc
    on tc.system = 'loinc' and tc.code = loinc.loinc
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
