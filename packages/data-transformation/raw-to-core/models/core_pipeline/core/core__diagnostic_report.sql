with base_resource as (
    select
        id,
        subject_reference,
        status,
        effectivedatetime,
        effectiveperiod_start,
        effectiveperiod_end,
        code_coding_0_code,
        code_coding_0_display,
        code_coding_0_system,   
        category_0_coding_0_code,
        category_0_coding_0_display,
        category_0_coding_0_system,
        meta_source
    from {{ref('stage__diagnosticreport')}}
),
target_code_codings as (
   {{   
        get_target_codings(
            get_diagnostic_report_codings,
            'diagnostic_report_id', 
            9, 
            none, 
            (
                'http://loinc.org',
            )
        ) 
    }}
),
target_category_codings as (
    {{ 
        get_target_codings(
            get_diagnostic_report_category_codings, 
            'diagnostic_report_id', 
            1, 
            1, 
            (
                'http://terminology.hl7.org/CodeSystem/v2-0074',
            )
        ) 
    }}
)
select
        cast(dr.id as {{ dbt.type_string() }} )                                                             as diagnostic_report_id
    ,   cast(right(dr.subject_reference, 36) as {{ dbt.type_string() }} )                                   as patient_id
    ,   cast(dr.status as {{ dbt.type_string() }} )                                                         as status
    ,   coalesce(
            {{ try_to_cast_date('dr.effectivedatetime') }}, 
            {{ try_to_cast_date('dr.effectiveperiod_start') }}
        )                                                                                                   as effective_date
    ,   {{ try_to_cast_date('dr.effectiveperiod_end') }}                                                    as end_date
    ,   cast(tc_loinc.code as {{ dbt.type_string() }} )                                                     as loinc_code
    ,   cast(tc_loinc.display as {{ dbt.type_string() }} )                                                  as loinc_display
    ,   cast(dr.code_coding_0_code as {{ dbt.type_string() }} )                                             as source_code_code
    ,   cast(dr.code_coding_0_display as {{ dbt.type_string() }} )                                          as source_code_display
    ,   cast(dr.code_coding_0_system as {{ dbt.type_string() }} )                                           as source_code_system
    ,   cast(category_hl7.code as {{ dbt.type_string() }} )                                                 as category_hl7_code
    ,   cast(category_hl7.display as {{ dbt.type_string() }} )                                              as category_hl7_display
    ,   cast(dr.category_0_coding_0_code as {{ dbt.type_string() }} )                                       as source_category_code
    ,   cast(dr.category_0_coding_0_display as {{ dbt.type_string() }} )                                    as source_category_display
    ,   cast(dr.category_0_coding_0_system as {{ dbt.type_string() }} )                                     as source_category_system
    ,   cast(dr.meta_source as {{ dbt.type_string() }} )                                                    as data_source
from base_resource dr
left join target_code_codings tc_loinc
    on dr.id = tc_loinc.diagnostic_report_id 
        and tc_loinc.system = 'http://loinc.org'
left join target_category_codings category_hl7
    on dr.id = category_hl7.diagnostic_report_id 
        and category_hl7.system = 'http://terminology.hl7.org/CodeSystem/v2-0074'
