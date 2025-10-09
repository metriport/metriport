with codings as (
    select
            condition_id
        ,   code
        ,   case 
                when system ilike '%icd-10%' or system = 'urn:oid:2.16.840.1.113883.3.623.1' then 'icd-10-cm'
                when system ilike '%snomed%' then 'snomed-ct'
                when system ilike '%icd-9%' then 'icd-9-cm'
                when system ilike '%loinc%' then 'loinc'
                else system
            end as system
        ,   display
    from {{ ref('stage__condition_code_coding') }}
    where code != ''
),
codings_with_static_rank as (
    select 
            condition_id
        ,   code
        ,   system
        ,   display
        ,   case 
                when system = 'icd-10-cm' then 0
                when system = 'snomed-ct' then 1
                when system = 'icd-9-cm' then 2
                when system = 'loinc' then 3
                else 4 
            end as static_rank
    from codings
),
codings_with_relative_rank as (
    select
            condition_id
        ,   case 
                when system in ('icd-10-cm', 'icd-9-cm') then replace(code, '.', '')
                else code 
            end as code
        ,   system
        ,   display
        ,   row_number() over(partition by condition_id order by static_rank) as relative_rank
    from codings_with_static_rank
),
target_coding as (
    select
        *
    from codings_with_relative_rank
    where relative_rank = 1
)
select
        cast(c.id as {{ dbt.type_string() }} )                                                              as condition_id
    ,   cast(p.id as {{ dbt.type_string() }} )                                                              as patient_id
    ,   cast(try_to_cast_date('c.recordeddate') as {{ dbt.type_string() }} )                                as recorded_date
    ,   coalesce(
            {{ try_to_cast_date('c.onsetdatetime') }}, 
            {{ try_to_cast_date('c.onsetperiod_start') }},
            {{ try_to_cast_date('c.onsetstring') }}
        )                                                                                                   as onset_date
    ,   {{ try_to_cast_date('c.onsetperiod_end') }}                                                         as resolved_date
    ,   cast(c.clinicalstatus_coding_0_display as {{ dbt.type_string() }} )                                 as status
    ,   cast(
            case 
                when c.category_0_coding_0_code in ('75326-9', '55607006') then 'problem'
                when c.category_0_coding_0_code in ('29308-4', '282291009') then 'diagnosis'
                when c.category_0_coding_0_code = '64572001' then 'disease'
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
    ,   cast(c.meta_source as {{ dbt.type_string() }} )                                                     as data_source
from {{ref('stage__condition')}} c
left join {{ref('stage__patient')}} p
    on right(c.subject_reference, 36) = p.id 
left join target_coding tc
    on c.id = tc.condition_id
left join {{ref('terminology__icd_10_cm')}} icd10
    on tc.system  = 'icd-10-cm' and tc.code = icd10.icd_10_cm
left join {{ref('terminology__snomed_ct')}} snomed
    on tc.system = 'snomed-ct' and tc.code = snomed.snomed_ct
left join {{ref('terminology__icd_9_cm')}} icd9
    on tc.system  = 'icd-9-cm' and tc.code = icd9.icd_9_cm
left join {{ref('terminology__loinc')}} loinc
    on tc.system = 'loinc' and tc.code = loinc.loinc
