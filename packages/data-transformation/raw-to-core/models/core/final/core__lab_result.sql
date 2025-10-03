select
      labs.lab_result_id
    , labs.person_id
    , labs.patient_id
    , labs.encounter_id
    , labs.accession_number
    , labs.source_code_type
    , labs.source_code
    , labs.source_description
    , labs.source_component
    , labs.source_component_type
    , labs.source_component_code
    , labs.source_component_description
    , case
        when labs.normalized_code_type is not null then labs.normalized_code_type
        when loinc.loinc is not null then 'loinc'
        when snomed_ct.snomed_ct is not null then 'snomed-ct'
        else null
      end as normalized_code_type
    , coalesce(
        labs.normalized_code
        , loinc.loinc
        , snomed_ct.snomed_ct
      ) as normalized_code
    , coalesce(
        labs.normalized_description
        , loinc.long_common_name
        , snomed_ct.description
      ) as normalized_description
    , case
        when labs.normalized_component_type is not null then labs.normalized_component_type
        when loinc_component.loinc is not null then 'loinc'
        when snomed_ct_component.snomed_ct is not null then 'snomed-ct'
        else null
      end as normalized_component_type
    , coalesce(
        labs.normalized_component_code
        , loinc_component.loinc
        , snomed_ct_component.snomed_ct
      ) as normalized_component_code
    , coalesce(
        labs.normalized_component_description
        , loinc_component.long_common_name
        , snomed_ct_component.description
      ) as normalized_component_description
    , labs.normalized_component
    , case
        when coalesce(
              labs.normalized_code
            , labs.normalized_component_code
        ) is not null then 'manual'
        when coalesce(
              loinc.loinc
            , snomed_ct.snomed_ct
            , loinc_component.loinc
            , snomed_ct_component.snomed_ct
        ) is not null then 'automatic'
      end as mapping_method
    , labs.status
    , labs.result
    , labs.result_date
    , labs.collection_date
    , labs.source_units
    , labs.normalized_units
    , labs.source_reference_range_low
    , labs.source_reference_range_high
    , labs.normalized_reference_range_low
    , labs.normalized_reference_range_high
    , labs.source_abnormal_flag
    , labs.normalized_abnormal_flag
    , labs.specimen
    , labs.ordering_practitioner_id
    , labs.data_source
    , labs.tuva_last_run
from {{ ref('core__stg_clinical_lab_result') }} as labs
    left outer join {{ ref('terminology__loinc') }} as loinc
        on labs.source_code_type = 'loinc'
        and labs.source_code = loinc.loinc
    left outer join {{ ref('terminology__snomed_ct') }} as snomed_ct
        on labs.source_code_type = 'snomed-ct'
        and labs.source_code = snomed_ct.snomed_ct
    left outer join {{ ref('terminology__loinc') }} as loinc_component
        on labs.source_component_type = 'loinc'
        and labs.source_component_code = loinc_component.loinc
    left outer join {{ ref('terminology__snomed_ct') }} as snomed_ct_component
        on labs.source_component_type = 'snomed-ct'
        and labs.source_component_code = snomed_ct_component.snomed_ct
