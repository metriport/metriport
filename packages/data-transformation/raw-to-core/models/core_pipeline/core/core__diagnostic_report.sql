with base_resource as (
    select
        id,
        subject_reference,
        status,
        effectivedatetime,
        effectiveperiod_start,
        effectiveperiod_end,
        presentedform_0_data,
        presentedform_1_data,
        presentedform_2_data,
        presentedform_3_data,
        presentedform_4_data,
        presentedform_5_data,
        presentedform_6_data,
        presentedform_7_data,
        presentedform_8_data,
        presentedform_9_data,
        presentedform_10_data,
        presentedform_11_data,
        presentedform_12_data,
        presentedform_13_data,
        presentedform_14_data,
        presentedform_15_data,
        presentedform_16_data,
        presentedform_17_data,
        presentedform_18_data,
        presentedform_19_data,
        presentedform_20_data,
        presentedform_21_data,
        presentedform_22_data,
        presentedform_23_data,
        presentedform_24_data,
        presentedform_25_data,
        presentedform_26_data,
        presentedform_27_data,
        presentedform_28_data,
        presentedform_29_data,
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
    ,   cast(
            coalesce(
                dr.presentedform_0_data,
                dr.presentedform_1_data,
                dr.presentedform_2_data,
                dr.presentedform_3_data,
                dr.presentedform_4_data,
                dr.presentedform_5_data,
                dr.presentedform_6_data,
                dr.presentedform_7_data,
                dr.presentedform_8_data,
                dr.presentedform_9_data,
                dr.presentedform_10_data,
                dr.presentedform_11_data,
                dr.presentedform_12_data,
                dr.presentedform_13_data,
                dr.presentedform_14_data,
                dr.presentedform_15_data,
                dr.presentedform_16_data,
                dr.presentedform_17_data,
                dr.presentedform_18_data,
                dr.presentedform_19_data,
                dr.presentedform_20_data,
                dr.presentedform_21_data,
                dr.presentedform_22_data,
                dr.presentedform_23_data,
                dr.presentedform_24_data,
                dr.presentedform_25_data,
                dr.presentedform_26_data,
                dr.presentedform_27_data,
                dr.presentedform_28_data,
                dr.presentedform_29_data
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as presented_form_text
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
