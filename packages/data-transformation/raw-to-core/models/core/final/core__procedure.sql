select
    prc.procedure_id
  , prc.person_id
  , prc.member_id
  , prc.patient_id
  , prc.encounter_id
  , prc.claim_id
  , prc.procedure_date
  , prc.source_code_type
  , prc.source_code
  , prc.source_description
  , case when prc.normalized_code_type is not null then prc.normalized_code_type
      when icd10.icd_10_pcs is not null then 'icd-10-pcs'
      when icd9.icd_9_pcs is not null then 'icd-9-pcs'
      when hcpcs.hcpcs is not null then 'hcpcs'
      when snomed_ct.snomed_ct is not null then 'snomed-ct'
      end as normalized_code_type
  , coalesce(prc.normalized_code
      , icd10.icd_10_pcs
      , icd9.icd_9_pcs
      , hcpcs.hcpcs
      , snomed_ct.snomed_ct) as normalized_code
  , coalesce(prc.normalized_description
      , icd10.description
      , icd9.short_description
      , hcpcs.short_description
      , snomed_ct.description) as normalized_description
  , case when coalesce(prc.normalized_code, prc.normalized_description) is not null then 'manual'
         when coalesce(icd10.icd_10_pcs, icd9.icd_9_pcs, hcpcs.hcpcs, snomed_ct.snomed_ct) is not null then 'automatic'
         end as mapping_method
  , prc.modifier_1
  , prc.modifier_2
  , prc.modifier_3
  , prc.modifier_4
  , prc.modifier_5
  , prc.practitioner_id
  , prc.data_source
  , prc.tuva_last_run
from {{ ref('core__stg_clinical_procedure') }} as prc
left outer join {{ ref('terminology__icd_10_pcs') }} as icd10
    on prc.source_code_type = 'icd-10-pcs'
        and prc.source_code = icd10.icd_10_pcs
left outer join {{ ref('terminology__icd_9_pcs') }} as icd9
    on prc.source_code_type = 'icd-9-pcs'
        and prc.source_code = icd9.icd_9_pcs
left outer join {{ ref('terminology__hcpcs_level_2') }} as hcpcs
    on prc.source_code_type = 'hcpcs'
        and prc.source_code = hcpcs.hcpcs
left outer join {{ ref('terminology__snomed_ct') }} as snomed_ct
    on prc.source_code_type = 'snomed-ct'
        and prc.source_code = snomed_ct.snomed_ct
