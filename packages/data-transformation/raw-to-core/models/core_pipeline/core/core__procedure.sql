with base_resource as (
    select
        id,
        subject_reference,
        status,
        performeddatetime,
        performedperiod_start,
        performedperiod_end,
        note_0_text,
        note_1_text,
        note_2_text,
        meta_source
    from {{ref('stage__procedure')}}
),
target_code_codings as (
   {{   
        get_target_codings(
            get_procedcure_codings,
            'procedure_id', 
            7, 
            none, 
            (
                'http://www.ama-assn.org/go/cpt',
                'http://snomed.info/sct'
            )
        ) 
    }}
),
target_bodysite_codings as (
    {{ 
        get_target_codings(
            get_procedcure_bodysite_codings, 
            'procedure_id', 
            1, 
            2, 
            (
                'http://snomed.info/sct',
            )
        ) 
    }}
),
target_reason_codings as (
    {{ 
        get_target_codings(
            get_procedcure_reason_codings, 
            'procedure_id', 
            1, 
            0,
            (
                'http://snomed.info/sct',
            )
        ) 
    }}
)
select
        cast(pro.id as {{ dbt.type_string() }} )                                                                    as procedure_id
    ,   cast(right(pro.subject_reference, 36) as {{ dbt.type_string() }} )                                          as patient_id
    ,   cast(pro.status as {{ dbt.type_string() }} )                                                                as status
    ,   coalesce(
            {{ try_to_cast_date('pro.performeddatetime', 'YYYY-MM-DD') }},
            {{ try_to_cast_date('pro.performedperiod_start', 'YYYY-MM-DD') }}
        )                                                                                                           as performed_date
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
    ,   cast(bodysite_snomed_ct.code as {{ dbt.type_string() }} )                                                   as bodysite_snomed_code
    ,   cast(bodysite_snomed_ct.display as {{ dbt.type_string() }} )                                                as bodysite_snomed_display
    ,   cast(reason_snomed_ct.code as {{ dbt.type_string() }} )                                                     as reason_snomed_code
    ,   cast(reason_snomed_ct.display as {{ dbt.type_string() }} )                                                  as reason_snomed_display
    ,   cast(
            coalesce(
                pro.note_0_text,
                pro.note_1_text,
                pro.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                           as note_text
    ,   cast(pro.meta_source as {{ dbt.type_string() }} )                                                           as data_source
from base_resource pro
left join target_code_codings tc_cpt
    on pro.id = tc_cpt.procedure_id 
        and tc_cpt.system = 'http://www.ama-assn.org/go/cpt'
left join target_code_codings tc_snomed_ct
    on pro.id = tc_snomed_ct.procedure_id 
        and tc_snomed_ct.system = 'http://snomed.info/sct'
left join target_bodysite_codings bodysite_snomed_ct
    on pro.id = bodysite_snomed_ct.procedure_id 
        and bodysite_snomed_ct.system = 'http://snomed.info/sct'
left join target_reason_codings reason_snomed_ct
    on pro.id = reason_snomed_ct.procedure_id 
        and reason_snomed_ct.system = 'http://snomed.info/sct'
left join {{ref('terminology__hcpcs_level_2')}} hcpcs
    on tc_cpt.code = hcpcs.hcpcs
left join {{ref('terminology__snomed_ct')}} snomed
    on tc_snomed_ct.code = snomed.snomed_ct
