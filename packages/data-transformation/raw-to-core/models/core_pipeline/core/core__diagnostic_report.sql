with code_loinc_coding as (
   {{   
        get_target_coding(
            get_diagnostic_report_codings,
            'stage__diagnosticreport', 
            'diagnostic_report_id', 
            9, 
            none, 
            'http://loinc.org'
        ) 
    }}
),
category_hl7_coding as (
    {{ 
        get_target_coding(
            get_diagnostic_report_category_codings, 
            'stage__diagnosticreport', 
            'diagnostic_report_id', 
            2, 
            1, 
            'http://terminology.hl7.org/CodeSystem/v2-0074'
        ) }}
)
select
        cast(dr.id as {{ dbt.type_string() }} )                                                             as diagnostic_report_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                              as patient_id
    ,   cast(dr.status as {{ dbt.type_string() }} )                                                         as status
    ,   coalesce(
            {{ try_to_cast_date('dr.effectivedatetime') }}, 
            {{ try_to_cast_date('dr.effectiveperiod_start') }}
        )                                                                                                   as start_date
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
    ,   cast(right(dr.encounter_reference, 36) as {{ dbt.type_string() }} )                                 as encounter_id
    ,   cast(
            case 
                when dr.performer_0_reference ilike '%practitioner%' 
                    then right(dr.performer_0_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                   as performer_practitioner_id
    ,   cast(
            case 
                when dr.performer_0_reference ilike '%organization%' 
                    then right(dr.performer_0_reference, 36)
                else null
            end as {{ dbt.type_string() }}
        )                                                                                                   as performer_organization_id
    ,   cast(dr.meta_source as {{ dbt.type_string() }} )                                                    as data_source
from {{ref('stage__diagnosticreport')}} dr
left join {{ref('stage__patient')}} p
    on right(dr.subject_reference, 36) = p.id
left join code_loinc_coding tc_loinc
    on dr.id = tc_loinc.diagnostic_report_id
left join category_hl7_coding category_hl7
    on dr.id = category_hl7.diagnostic_report_id
left join {{ref('terminology__loinc')}} loinc
    on tc_loinc.code = loinc.loinc
