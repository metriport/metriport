/* ============================================================
   Purpose
   -------
   Flag "hyperlipidemia suspects" from LAB_RESULT using lipid panel
   measurements while EXCLUDING patients already diagnosed with
   hyperlipidemia (E78.*).

   Criteria (single-observation flags)
   -----------------------------------
   - LDL-C ≥ 190 mg/dL (severe hyperlipidemia) → hyperlipidemia_severe_ldl
   - LDL-C ≥ 160 mg/dL (moderate hyperlipidemia) → hyperlipidemia_moderate_ldl  
   - Total cholesterol ≥ 240 mg/dL → hyperlipidemia_total_chol
   - Mixed: LDL ≥ 160 mg/dL + TG ≥ 200 mg/dL → hyperlipidemia_mixed
   
   Exclusions
   ----------
   - Existing hyperlipidemia diagnosis (E78.*)

   Safety / Implementation
   -----------------------
   - TRY_TO_DOUBLE used for non-numeric RESULT handling
   - Unit normalization: mg/dL primary, mmol/L conversion when detected
   - Minimal FHIR embedded for UI rendering
   ============================================================ */

WITH hyperlipidemia_dx_exclusion AS (
  /* Exclude patients with existing hyperlipidemia diagnoses */
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'E78.%'
),

lipid_measurements AS (
  /* Extract and normalize lipid panel results */
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    CAST(lr.RESULT_DATE AS DATE)                          AS obs_date,
    lr.DATA_SOURCE,
    
    /* Normalize values to mg/dL */
    CASE 
      /* LDL Cholesterol normalization */
      WHEN lr.NORMALIZED_CODE IN ('2089-1','13457-7','18262-6','39469-2') THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 38.67  -- mmol/L to mg/dL conversion
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      /* Total Cholesterol normalization */  
      WHEN lr.NORMALIZED_CODE = '2093-3' THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 38.67
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      /* Triglycerides normalization */
      WHEN lr.NORMALIZED_CODE = '2571-8' THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 88.57  -- mmol/L to mg/dL conversion
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      /* HDL Cholesterol normalization */
      WHEN lr.NORMALIZED_CODE = '2085-9' THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 38.67
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      /* Non-HDL Cholesterol */
      WHEN lr.NORMALIZED_CODE = '43396-1' THEN TRY_TO_DOUBLE(lr.RESULT)
      ELSE NULL
    END AS value_mg_dl,
    
    /* Categorize lipid type */
    CASE 
      WHEN lr.NORMALIZED_CODE IN ('2089-1','13457-7','18262-6','39469-2') THEN 'LDL'
      WHEN lr.NORMALIZED_CODE = '2093-3' THEN 'TOTAL_CHOL'
      WHEN lr.NORMALIZED_CODE = '2571-8' THEN 'TRIGLYCERIDES' 
      WHEN lr.NORMALIZED_CODE = '2085-9' THEN 'HDL'
      WHEN lr.NORMALIZED_CODE = '43396-1' THEN 'NON_HDL'
    END AS lipid_type

  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN (
      '2089-1',   -- LDL direct
      '13457-7',  -- LDL calculated  
      '18262-6',  -- LDL direct assay
      '39469-2',  -- LDL molar
      '2093-3',   -- Total cholesterol
      '2571-8',   -- Triglycerides
      '2085-9',   -- HDL cholesterol
      '43396-1'   -- Non-HDL cholesterol
    )
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM hyperlipidemia_dx_exclusion x WHERE x.PATIENT_ID = lr.PATIENT_ID)
),

/* Get latest values per patient for each lipid type */
latest_lipids AS (
  SELECT 
    PATIENT_ID,
    lipid_type,
    value_mg_dl,
    resource_id,
    NORMALIZED_CODE,
    NORMALIZED_DESCRIPTION,
    RESULT,
    units,
    obs_date,
    DATA_SOURCE
  FROM lipid_measurements 
  WHERE value_mg_dl IS NOT NULL
    AND value_mg_dl BETWEEN 10 AND 2000  -- Plausibility range
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PATIENT_ID, lipid_type 
    ORDER BY obs_date DESC, resource_id DESC
  ) = 1
),

/* Pivot lipid values for combined analysis */
patient_lipid_profile AS (
  SELECT 
    PATIENT_ID,
    MAX(CASE WHEN lipid_type = 'LDL' THEN value_mg_dl END) AS ldl_mg_dl,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN value_mg_dl END) AS total_chol_mg_dl,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN value_mg_dl END) AS tg_mg_dl,
    MAX(CASE WHEN lipid_type = 'HDL' THEN value_mg_dl END) AS hdl_mg_dl,
    MAX(CASE WHEN lipid_type = 'NON_HDL' THEN value_mg_dl END) AS non_hdl_mg_dl,
    
    /* Store resource IDs for FHIR generation */
    MAX(CASE WHEN lipid_type = 'LDL' THEN resource_id END) AS ldl_resource_id,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN resource_id END) AS total_chol_resource_id,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN resource_id END) AS tg_resource_id,
    
    /* Store other fields for FHIR */
    MAX(CASE WHEN lipid_type = 'LDL' THEN obs_date END) AS ldl_date,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN obs_date END) AS total_chol_date,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN obs_date END) AS tg_date,
    
    MAX(CASE WHEN lipid_type = 'LDL' THEN DATA_SOURCE END) AS ldl_source,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN DATA_SOURCE END) AS total_chol_source,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN DATA_SOURCE END) AS tg_source
    
  FROM latest_lipids
  GROUP BY PATIENT_ID
),

hyperlipidemia_suspects AS (
  /* Apply thresholds and categorize suspects */
  SELECT 
    p.PATIENT_ID,
    
    /* Determine suspect category */
    CASE 
      WHEN p.ldl_mg_dl >= 190 THEN 'hyperlipidemia_severe_ldl'
      WHEN p.ldl_mg_dl >= 160 AND p.tg_mg_dl >= 200 THEN 'hyperlipidemia_mixed'
      WHEN p.ldl_mg_dl >= 160 THEN 'hyperlipidemia_moderate_ldl'
      WHEN p.total_chol_mg_dl >= 240 THEN 'hyperlipidemia_total_chol'
      ELSE NULL
    END AS suspect_group,
    
    /* Assign ICD-10 codes based on pattern */
    CASE 
      WHEN p.ldl_mg_dl >= 190 THEN 'E78.0'
      WHEN p.ldl_mg_dl >= 160 AND p.tg_mg_dl >= 200 THEN 'E78.2'
      WHEN p.ldl_mg_dl >= 160 THEN 'E78.0'
      WHEN p.total_chol_mg_dl >= 240 THEN 'E78.5'
      ELSE NULL
    END AS suspect_icd10_code,
    
    CASE 
      WHEN p.ldl_mg_dl >= 190 THEN 'Pure hypercholesterolemia (severe)'
      WHEN p.ldl_mg_dl >= 160 AND p.tg_mg_dl >= 200 THEN 'Mixed hyperlipidemia'
      WHEN p.ldl_mg_dl >= 160 THEN 'Pure hypercholesterolemia (moderate)'
      WHEN p.total_chol_mg_dl >= 240 THEN 'Hyperlipidemia, unspecified'
      ELSE NULL
    END AS suspect_icd10_short_description,
    
    /* Primary contributing measurement for FHIR */
    CASE 
      WHEN p.ldl_mg_dl >= 190 OR p.ldl_mg_dl >= 160 THEN p.ldl_resource_id
      WHEN p.total_chol_mg_dl >= 240 THEN p.total_chol_resource_id
      ELSE p.ldl_resource_id
    END AS primary_resource_id,
    
    CASE 
      WHEN p.ldl_mg_dl >= 190 OR p.ldl_mg_dl >= 160 THEN p.ldl_date
      WHEN p.total_chol_mg_dl >= 240 THEN p.total_chol_date
      ELSE p.ldl_date
    END AS primary_obs_date,
    
    CASE 
      WHEN p.ldl_mg_dl >= 190 OR p.ldl_mg_dl >= 160 THEN p.ldl_source
      WHEN p.total_chol_mg_dl >= 240 THEN p.total_chol_source
      ELSE p.ldl_source
    END AS primary_data_source,
    
    /* Include values for FHIR display */
    p.ldl_mg_dl,
    p.total_chol_mg_dl,
    p.tg_mg_dl
    
  FROM patient_lipid_profile p
  WHERE (
    p.ldl_mg_dl >= 160 
    OR p.total_chol_mg_dl >= 240 
    OR (p.ldl_mg_dl >= 160 AND p.tg_mg_dl >= 200)
  )
),

/* Build minimal FHIR Observation JSON */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    
    /* Get the corresponding lab details for FHIR */
    l.NORMALIZED_CODE,
    l.NORMALIZED_DESCRIPTION,
    l.RESULT,
    l.units,
    
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.primary_resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   l.NORMALIZED_DESCRIPTION,
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     l.NORMALIZED_CODE,
            'display',  l.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.primary_obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        OBJECT_CONSTRUCT(
          'value', 
            CASE 
              WHEN s.ldl_mg_dl >= 160 THEN s.ldl_mg_dl
              WHEN s.total_chol_mg_dl >= 240 THEN s.total_chol_mg_dl
            END,
          'unit',  'mg/dL'
        )
    ) AS fhir,
    
    s.primary_resource_id AS resource_id,
    'Observation' AS resource_type,
    s.primary_data_source AS data_source
    
  FROM hyperlipidemia_suspects s
  JOIN latest_lipids l ON l.resource_id = s.primary_resource_id
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  
  /* Enriched responsible_resources for UI */
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  
  CURRENT_TIMESTAMP() AS last_run

FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
