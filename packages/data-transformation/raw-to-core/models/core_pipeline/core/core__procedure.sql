with code_cpt_coding as (
   {{   
        get_target_coding(
            get_procedcure_codings,
            'stage__procedure', 
            'procedure_id', 
            7, 
            none, 
            'http://www.ama-assn.org/go/cpt'
        ) 
    }}
),
code_snomed_ct_coding as (
   {{   
        get_target_coding(
            get_procedcure_codings,
            'stage__procedure', 
            'procedure_id', 
            7, 
            none, 
            'http://snomed.info/sct'
        ) 
    }}
),
bodysite_snomed_ct_coding as (
    {{ 
        get_target_coding(
            get_procedcure_bodysite_codings, 
            'stage__procedure', 
            'procedure_id', 
            1, 
            2, 
            'http://snomed.info/sct'
        ) }}
),
reason_snomed_ct_coding as (
    {{ 
        get_target_coding(
            get_procedcure_reason_codings, 
            'stage__procedure', 
            'procedure_id', 
            9, 
            0,
            'http://snomed.info/sct'
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
        )                                                                                                           as start_date
    ,   {{ try_to_cast_date('pro.performedperiod_end', 'YYYY-MM-DD') }}                                             as end_date
    ,   cast(
            coalesce(
                hcpcs.hcpcs,
                tc_cpt.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as cpt_code
    ,   cast(
            coalesce(
                hcpcs.long_description,
                tc_cpt.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as cpt_display
    ,   cast(
            coalesce(
                snomed.snomed_ct,
                tc_snomed_ct.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as snomed_code
    ,   cast(
            coalesce(
                snomed.description,
                tc_snomed_ct.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as snomed_display
    ,   cast(
            coalesce(
                snomed_bodysite.snomed_ct,
                bodysite_snomed_ct.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as bodysite_snomed_ode
    ,   cast(
            coalesce(
                snomed_bodysite.description,
                bodysite_snomed_ct.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as bodysite_snomed_display
    ,   cast(
            coalesce(
                snomed_reason.snomed_ct,
                reason_snomed_ct.code
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as reason_snomed_code
    ,   cast(
            coalesce(
                snomed_reason.description,
                reason_snomed_ct.display
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as reason_snomed_display
    ,   cast(
            coalesce(
                pro.note_0_text,
                pro.note_1_text,
                pro.note_2_text,
                pro.note_3_text,
                pro.note_4_text,
                pro.note_5_text,
                pro.note_6_text,
                pro.note_7_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as note_text
    ,   cast(
            case 
                when pro.performer_0_actor_reference ilike '%practitioner%' 
                    then right(pro.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                           as performer_practitioner_id
    ,   cast(
            case 
                when pro.performer_0_actor_reference ilike '%organization%' 
                    then right(pro.performer_0_actor_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                           as performer_organization_id
    ,   cast(pro.meta_source as {{ dbt.type_string() }} )                                                           as data_source
from {{ref('stage__procedure' )}} pro
left join {{ref('stage__patient')}} pat
    on right(pro.subject_reference, 36) = pat.id
left join code_cpt_coding tc_cpt
    on pro.id = tc_cpt.procedure_id
left join code_snomed_ct_coding tc_snomed_ct
    on pro.id = tc_snomed_ct.procedure_id
left join bodysite_snomed_ct_coding bodysite_snomed_ct
    on pro.id = bodysite_snomed_ct.procedure_id
left join reason_snomed_ct_coding reason_snomed_ct
    on pro.id = reason_snomed_ct.procedure_id
left join {{ref('terminology__hcpcs_level_2')}} hcpcs
    on tc_cpt.code = hcpcs.hcpcs
left join {{ref('terminology__snomed_ct')}} snomed
    on tc_snomed_ct.code = snomed.snomed_ct
left join {{ref('terminology__snomed_ct')}} snomed_bodysite
    on bodysite_snomed_ct.code = snomed.snomed_ct
left join {{ref('terminology__snomed_ct')}} snomed_reason
    on reason_snomed_ct.code = snomed.snomed_ct
