select
    cond.condition_id
  , cond.person_id
  , cond.member_id
  , cond.patient_id
  , cond.encounter_id
  , cond.claim_id
  , cond.recorded_date
  , cond.onset_date
  , cond.resolved_date
  , cond.status
  , cond.condition_type
  , cond.source_code_type
  , cond.source_code
  , cond.source_description
  , case
        when cond.normalized_code_type is not null then cond.normalized_code_type
        when icd10.icd_10_cm is not null then 'icd-10-cm'
        when icd9.icd_9_cm is not null then 'icd-9-cm'
        when snomed_ct.snomed_ct is not null then 'snomed-ct'
        else null end as normalized_code_type
  , coalesce(
        cond.normalized_code
      , icd10.icd_10_cm
      , icd9.icd_9_cm
      , snomed_ct.snomed_ct) as normalized_code
  , coalesce(
        cond.normalized_description
      , icd10.short_description
      , icd9.short_description
      , snomed_ct.description) as normalized_description
  , case when coalesce(cond.normalized_code, cond.normalized_description) is not null then 'manual'
         when coalesce(icd10.icd_10_cm, icd9.icd_9_cm, snomed_ct.snomed_ct) is not null then 'automatic'
         end as mapping_method
  , cond.condition_rank
  , cond.present_on_admit_code
  , cond.present_on_admit_description
  , cond.data_source
  , cond.tuva_last_run
from {{ ref('core__stg_clinical_condition') }} cond
left outer join {{ ref('terminology__icd_10_cm') }} as icd10
    on cond.source_code_type = 'icd-10-cm'
        and replace(cond.source_code, '.', '') = icd10.icd_10_cm
left outer join {{ ref('terminology__icd_9_cm') }} as icd9
    on cond.source_code_type = 'icd-9-cm'
        and replace(cond.source_code, '.', '') = icd9.icd_9_cm
left outer join {{ ref('terminology__snomed_ct') }} as snomed_ct
    on cond.source_code_type = 'snomed-ct'
        and cond.source_code = snomed_ct.snomed_ct
