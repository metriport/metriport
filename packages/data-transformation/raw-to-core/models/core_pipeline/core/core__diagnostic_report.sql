with base_resource as (
    select
        id,
        subject_reference,
        status,
        effectivedatetime,
        effectiveperiod_start,
        effectiveperiod_end,
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
            2, 
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
    ,   cast(category_hl7.code as {{ dbt.type_string() }} )                                                 as category_hl7_code
    ,   cast(category_hl7.display as {{ dbt.type_string() }} )                                              as category_hl7_display
    ,   cast(dr.meta_source as {{ dbt.type_string() }} )                                                    as data_source
from base_resource dr
left join target_code_codings tc_loinc
    on dr.id = tc_loinc.diagnostic_report_id 
        and tc_loinc.system = 'http://loinc.org'
left join target_category_codings category_hl7
    on dr.id = category_hl7.diagnostic_report_id 
        and category_hl7.system = 'http://terminology.hl7.org/CodeSystem/v2-0074'
left join {{ref('terminology__loinc')}} loinc
    on tc_loinc.code = loinc.loinc
