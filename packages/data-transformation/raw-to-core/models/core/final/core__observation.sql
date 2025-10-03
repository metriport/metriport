select
      obs.observation_id
    , obs.person_id
    , obs.patient_id
    , obs.encounter_id
    , obs.panel_id
    , obs.observation_date
    , case
        when ot.observation_type is not null then ot.observation_type
        else obs.observation_type
      end as observation_type
    , obs.source_code_type
    , obs.source_code
    , obs.source_description
    , case
        when obs.normalized_code_type is not null then obs.normalized_code_type
        when icd10cm.icd_10_cm is not null then 'icd-10-cm'
        when icd9cm.icd_9_cm is not null then 'icd-9-cm'
        when icd10pcs.icd_10_pcs is not null then 'icd-10-pcs'
        when icd9pcs.icd_9_pcs is not null then 'icd-10-pcs'
        when hcpcs.hcpcs is not null then 'hcpcs'
        when snomed_ct.snomed_ct is not null then 'snomed-ct'
        when loinc.loinc is not null then 'loinc'
        end as normalized_code_type
  , coalesce(
        obs.normalized_code
      , icd10cm.icd_10_cm
      , icd9cm.icd_9_cm
      , icd10pcs.icd_10_pcs
      , icd9pcs.icd_9_pcs
      , hcpcs.hcpcs
      , snomed_ct.snomed_ct
      , loinc.loinc
      ) as normalized_code
      , coalesce(
        obs.normalized_description
      , icd10cm.short_description
      , icd9cm.short_description
      , icd10pcs.description
      , icd9pcs.short_description
      , hcpcs.short_description
      , snomed_ct.description
      , loinc.long_common_name
      ) as normalized_description
     , case
         when coalesce(obs.normalized_code, obs.normalized_description) is not null then 'manual'
         when coalesce(
            icd10cm.icd_10_cm
          , icd9cm.icd_9_cm
          , icd10pcs.icd_10_pcs
          , icd9pcs.icd_9_pcs
          , hcpcs.hcpcs
          , snomed_ct.snomed_ct
          , loinc.loinc) is not null then 'automatic'
         end as mapping_method
    , obs.result
    , obs.source_units
    , obs.normalized_units
    , obs.source_reference_range_low
    , obs.source_reference_range_high
    , obs.normalized_reference_range_low
    , obs.normalized_reference_range_high
    , obs.data_source
    , obs.tuva_last_run
from {{ ref('core__stg_clinical_observation') }} as obs
left outer join {{ ref('terminology__icd_10_cm') }} as icd10cm
    on obs.source_code_type = 'icd-10-cm'
        and replace(obs.source_code, '.', '') = icd10cm.icd_10_cm
left outer join {{ ref('terminology__icd_9_cm') }} as icd9cm
    on obs.source_code_type = 'icd-9-cm'
        and replace(obs.source_code, '.', '') = icd9cm.icd_9_cm
left outer join {{ ref('terminology__icd_10_pcs') }} as icd10pcs
    on obs.source_code_type = 'icd-10-pcs'
        and obs.source_code = icd10pcs.icd_10_pcs
left outer join {{ ref('terminology__icd_9_pcs') }} as icd9pcs
    on obs.source_code_type = 'icd-9-pcs'
        and replace(obs.source_code, '.', '') = icd9pcs.icd_9_pcs
left outer join {{ ref('terminology__hcpcs_level_2') }} as hcpcs
    on obs.source_code_type = 'hcpcs'
        and obs.source_code = hcpcs.hcpcs
left outer join {{ ref('terminology__snomed_ct') }} as snomed_ct
    on obs.source_code_type = 'snomed-ct'
        and obs.source_code = snomed_ct.snomed_ct
left outer join {{ ref('terminology__loinc') }} as loinc
    on obs.source_code_type = 'loinc'
        and obs.source_code = loinc.loinc
left outer join {{ ref('terminology__observation_type') }} as ot
    on lower(obs.observation_type) = ot.observation_type
