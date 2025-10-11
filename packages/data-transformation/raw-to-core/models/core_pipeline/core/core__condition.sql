with target_coding as (
   {{   
        get_target_coding(
            get_condition_codings,
            'stage__condition', 
            'condition_id', 
            8, 
            none, 
            condition_code_system
        ) 
    }}
),
target_category_coding as (
    {{ 
        get_target_coding(
            get_condition_category_codings, 
            'stage__condition', 
            'condition_id', 
            2, 
            1, 
            condition_category_code_system
        ) }}
),
target_clinical_status_coding as (
    {{ 
        get_target_coding(
            get_condition_clinical_status_codings, 
            'stage__condition', 
            'condition_id', 
            1, 
            none,
            condition_clinical_status_code_system
        ) 
    }}
),
target_bodysite_coding as (
    {{ 
        get_target_coding(
            get_condition_bodysite_codings, 
            'stage__condition', 
            'condition_id', 
            1, 
            1,
            condition_bodysite_code_system
        ) 
    }}
)
select
        cast(c.id as {{ dbt.type_string() }} )                                                              as condition_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                              as patient_id
    ,   {{ try_to_cast_date('c.recordeddate') }}                                                            as recorded_date
    ,   coalesce(
            {{ try_to_cast_date('c.onsetdatetime') }}, 
            {{ try_to_cast_date('c.onsetperiod_start') }},
            {{ try_to_cast_date('c.onsetstring') }}
        )                                                                                                   as onset_date
    ,   {{ try_to_cast_date('c.onsetperiod_end') }}                                                         as resolved_date
    ,   cast(
            case 
                when tc_cat.code in ('75326-9', '55607006') then 'problem'
                when tc_cat.code in ('29308-4', '282291009') then 'diagnosis'
                when tc_cat.code = '64572001' then 'disease'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                   as category
    ,   cast(tc.system as {{ dbt.type_string() }} )                                                         as source_code_type
    ,   cast(tc.code as {{ dbt.type_string() }} )                                                           as source_code
    ,   cast(tc.display as {{ dbt.type_string() }} )                                                        as source_description
    ,   cast(
            case
                when icd10.icd_10_cm is not null then 'icd-10-cm'
                when snomed.snomed_ct is not null then 'snomed-ct'
                when icd9.icd_9_cm is not null then 'icd-9-cm'
                when loinc.loinc is not null then 'loinc'
                else null
            end as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_code_type
    ,   cast(
            coalesce(
                icd10.icd_10_cm, 
                snomed.snomed_ct,
                icd9.icd_9_cm, 
                loinc.loinc
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_code
    ,   cast(
            coalesce(
                icd10.long_description, 
                snomed.description,
                icd9.long_description, 
                loinc.long_common_name
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as normalized_description
    ,   cast(tc_cs.system as {{ dbt.type_string() }} )                                                      as status_code_type
    ,   cast(tc_cs.code as {{ dbt.type_string() }} )                                                        as status_code
    ,   cast(tc_cs.display as {{ dbt.type_string() }} )                                                     as status_description
    ,   cast(tc_cat.system as {{ dbt.type_string() }} )                                                     as category_code_type
    ,   cast(tc_cat.code as {{ dbt.type_string() }} )                                                       as category_code
    ,   cast(tc_cat.display as {{ dbt.type_string() }} )                                                    as category_description
    ,   cast(tc_bs.system as {{ dbt.type_string() }} )                                                      as bodysite_code_type
    ,   cast(tc_bs.code as {{ dbt.type_string() }} )                                                        as bodysite_code
    ,   cast(tc_bs.display as {{ dbt.type_string() }} )                                                     as bodysite_description
    ,   cast(
            coalesce(
                c.note_0_text,
                c.note_1_text,
                c.note_2_text
            ) as {{ dbt.type_string() }} 
        )                                                                                                   as note
    ,   cast(right(c.recorder_reference, 36) as {{ dbt.type_string() }} )                                   as practitioner_id
    ,   cast(c.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from {{ref('stage__condition')}} c
left join {{ref('stage__patient')}} p
    on right(c.subject_reference, 36) = p.id 
left join target_coding tc
    on c.id = tc.condition_id
left join target_category_coding tc_cat
    on c.id = tc_cat.condition_id
left join target_clinical_status_coding tc_cs
    on c.id = tc_cs.condition_id
left join target_bodysite_coding tc_bs
    on c.id = tc_bs.condition_id
left join {{ref('terminology__icd_10_cm')}} icd10
    on tc.system  = 'icd-10-cm' and tc.code = icd10.icd_10_cm
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
left join {{ref('terminology__icd_9_cm')}} icd9
    on tc.system  = 'icd-9-cm' and tc.code = icd9.icd_9_cm
left join {{ref('terminology__loinc')}} loinc
    on tc.system = 'loinc' and tc.code = loinc.loinc
