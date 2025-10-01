select
    all_procedures.procedure_id
  , all_procedures.person_id
  , all_procedures.member_id
  , all_procedures.patient_id
  , all_procedures.encounter_id
  , all_procedures.claim_id
  , all_procedures.procedure_date
  , all_procedures.source_code_type
  , all_procedures.source_code
  , all_procedures.source_description
  , case when all_procedures.normalized_code_type is not null then all_procedures.normalized_code_type
      when icd10.icd_10_pcs is not null then 'icd-10-pcs'
      when icd9.icd_9_pcs is not null then 'icd-9-pcs'
      when hcpcs.hcpcs is not null then 'hcpcs'
      when snomed_ct.snomed_ct is not null then 'snomed-ct'
      end as normalized_code_type
  , coalesce(all_procedures.normalized_code
      , icd10.icd_10_pcs
      , icd9.icd_9_pcs
      , hcpcs.hcpcs
      , snomed_ct.snomed_ct) as normalized_code
  , coalesce(all_procedures.normalized_description
      , icd10.description
      , icd9.short_description
      , hcpcs.short_description
      , snomed_ct.description) as normalized_description
  , case when coalesce(all_procedures.normalized_code, all_procedures.normalized_description) is not null then 'manual'
         when coalesce(icd10.icd_10_pcs, icd9.icd_9_pcs, hcpcs.hcpcs, snomed_ct.snomed_ct) is not null then 'automatic'
         end as mapping_method
  , all_procedures.modifier_1
  , all_procedures.modifier_2
  , all_procedures.modifier_3
  , all_procedures.modifier_4
  , all_procedures.modifier_5
  , all_procedures.practitioner_id
  , all_procedures.data_source
  , all_procedures.tuva_last_run
from {{ ref('core__stg_clinical_procedure') }} all_procedures
left outer join {{ ref('terminology__icd_10_pcs') }} as icd10
    on all_procedures.source_code_type = 'icd-10-pcs'
        and all_procedures.source_code = icd10.icd_10_pcs
left outer join {{ ref('terminology__icd_9_pcs') }} as icd9
    on all_procedures.source_code_type = 'icd-9-pcs'
        and all_procedures.source_code = icd9.icd_9_pcs
left outer join {{ ref('terminology__hcpcs_level_2') }} as hcpcs
    on all_procedures.source_code_type = 'hcpcs'
        and all_procedures.source_code = hcpcs.hcpcs
left outer join {{ ref('terminology__snomed_ct') }} as snomed_ct
    on all_procedures.source_code_type = 'snomed-ct'
        and all_procedures.source_code = snomed_ct.snomed_ct
