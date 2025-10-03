with coding as (
    select
          ccc.condition_id
        , ccc.code as code
        , case when ccc.system in (
            'http://hl7.org/fhir/sid/icd-10-cm'
            ,'http://hl7.org/fhir/sid/icd-10'
            ,'urn:oid:2.16.840.1.113883.3.623.1'
            ) then 'icd-10-cm'
        when ccc.system in(
            'http://hl7.org/fhir/sid/icd-9',
            'http://hl7.org/fhir/sid/icd-9-cm'
            ) then 'icd-9-cm'
        when ccc.system = 'http://snomed.info/sct'
            then 'snomed-ct'
        when ccc.system = 'http://loinc.org'
            then 'loinc'
        else ccc.system
        end as system
        , ccc.display as display
    from {{ref('stage__condition_code_coding')}} ccc
)

,condition_code as (
    select * from (
        select 
            *,
            row_number() over(partition by condition_id order by
                case system
                    when 'icd-10-cm' then 0
                    when 'snomed-ct' then 1
                    when 'icd-9-cm' then 2
                    when 'loinc' then 3
                    else 4 end
                , code
            ) as rn
         from (
            select
                cc.condition_id
                , case when cc.system in ('icd-10-cm','icd-9-cm') 
                    then replace(cc.code,'.','')
                    else cc.code end as code
                , cc.system
                , cc.display
            from coding cc
        ) as x
    ) as x
    where rn = 1
)
select
      cast(c.id as {{ dbt.type_string() }} )                                                            as condition_id
    , cast(p.id as {{ dbt.type_string() }} )                                                            as patient_id
    , cast(null as {{ dbt.type_string() }} )                                                            as encounter_id
    , cast(null as {{ dbt.type_string() }} )                                                            as claim_id
    , cast(null as {{ dbt.type_string() }} )                                                            as recorded_date
    , coalesce(
        {{ try_to_cast_date('c.onsetperiod_start') }}, 
        {{ try_to_cast_date('c.onsetperiod_end') }} )                                                   as onset_date
    , {{ try_to_cast_date('c.onsetperiod_end') }}                                                       as resolved_date
    , cast(c.clinicalstatus_coding_0_display as {{ dbt.type_string() }} )                               as status
    , cast(
        case when CATEGORY_0_CODING_0_CODE in ('75326-9','55607006')
            then 'problem'
        when CATEGORY_0_CODING_0_CODE in ('282291009','29308-4')
            then 'diagnosis'
        when CATEGORY_0_CODING_0_CODE = '64572001'
            then 'disease'
        end as {{ dbt.type_string() }} )                                                                as condition_type
    , cast(null as {{ dbt.type_string() }} )                                                            as source_code_type
    , cast(null as {{ dbt.type_string() }} )                                                            as source_code
    , cast(null as {{ dbt.type_string() }} )                                                            as source_description
    , cast(case
            when icd10.icd_10_cm is not null then 'icd-10-cm'
            when icd9.icd_9_cm is not null then 'icd-9-cm'
            when loinc.loinc is not null then 'loinc'
            when snomed.snomed_ct is not null then 'snomed-ct'
            end
        as {{ dbt.type_string() }} )                                                                    as normalized_code_type
    , cast(coalesce(
            replace(icd10.icd_10_cm,'.',''), 
            icd9.icd_9_cm, 
            loinc.loinc, 
            snomed.snomed_ct
        )  as {{ dbt.type_string() }} )                                                                 as normalized_code
   , cast(coalesce(
            icd10.long_description, 
            icd9.long_description, 
            loinc.long_common_name, 
            snomed.description
        ) as {{ dbt.type_string() }} )                                                                  as normalized_description
    , cast(null as {{ dbt.type_int() }} )                                                               as condition_rank
    , cast(null as {{ dbt.type_string() }} )                                                            as present_on_admit_code
    , cast(null as {{ dbt.type_string() }} )                                                            as present_on_admit_description
    , cast(c.meta_source as {{ dbt.type_string() }} )                                                   as data_source
from {{ref('stage__condition')}} c
left join {{ref('stage__patient')}} p
    on right(c.subject_reference, 36) = p.id
left join condition_code cc
    on c.id = cc.condition_id
left join {{ref('terminology__icd_10_cm')}} icd10
    on cc.system  = 'icd-10-cm' and cc.code = icd10.icd_10_cm
left join {{ref('terminology__icd_9_cm')}} icd9
    on cc.system  = 'icd-9-cm' and cc.code = icd9.icd_9_cm
left join {{ref('terminology__loinc')}} loinc
    on cc.system = 'loinc' and cc.code = loinc.loinc
left join {{ref('terminology__snomed_ct')}} snomed
    on cc.system = 'snomed-ct' and cc.code = snomed.snomed_ct
