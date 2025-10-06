/* ============================================================
   Purpose
   -------
   Flag "hyperlipidemia suspects" from LAB_RESULT using a
   more sensitive screening approach (per MD feedback), while
   EXCLUDING patients already diagnosed with hyperlipidemia (E78.*).

   Sensitive Criteria (single-observation flags)
   ---------------------------------------------
   - Total cholesterol ≥ 200 mg/dL      → hyperlipidemia_totalchol_200plus
   - LDL-C ≥ 130 mg/dL                  → hyperlipidemia_ldl_130plus
   - Triglycerides ≥ 200 mg/dL          → hyperlipidemia_tg_200plus

   Exclusions
   ----------
   - Existing hyperlipidemia diagnosis (E78.*)

   Safety / Implementation
   -----------------------
   - TRY_TO_DOUBLE for non-numeric RESULT handling
   - Unit normalization: mg/dL primary; mmol/L → mg/dL where needed
   - Minimal FHIR embedded for UI rendering
   ============================================================ */

WITH hyperlipidemia_dx_exclusion AS (
  /* Exclude patients with existing hyperlipidemia diagnoses */
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'E78%'
),

lipid_measurements AS (
  /* Extract and normalize lipid panel results to mg/dL */
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                       AS resource_id,
    'Observation'                                          AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    CAST(lr.RESULT_DATE AS DATE)                           AS obs_date,
    lr.DATA_SOURCE,

    /* Normalize to mg/dL (38.67 for chol/LDL/HDL; 88.57 for TG) */
    CASE 
      WHEN lr.NORMALIZED_CODE IN ('2089-1','13457-7','18262-6','39469-2') THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 38.67  -- LDL mmol/L → mg/dL
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      WHEN lr.NORMALIZED_CODE = '2093-3' THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 38.67  -- Total chol mmol/L → mg/dL
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      WHEN lr.NORMALIZED_CODE = '2571-8' THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 88.57  -- TG mmol/L → mg/dL
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      WHEN lr.NORMALIZED_CODE = '2085-9' THEN
        CASE 
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%mmol%' 
            THEN TRY_TO_DOUBLE(lr.RESULT) * 38.67  -- HDL mmol/L → mg/dL
          ELSE TRY_TO_DOUBLE(lr.RESULT)
        END
      WHEN lr.NORMALIZED_CODE = '43396-1' THEN TRY_TO_DOUBLE(lr.RESULT)  -- Non-HDL (already mg/dL typically)
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

  FROM core_v2.CORE_V2__LAB_RESULT lr
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
    AND NOT EXISTS (
      SELECT 1 FROM hyperlipidemia_dx_exclusion x
      WHERE x.PATIENT_ID = lr.PATIENT_ID
    )
),

/* Latest value per lipid type per patient (avoid mixing dates across types) */
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
    AND value_mg_dl BETWEEN 10 AND 2000  -- plausibility guard
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PATIENT_ID, lipid_type 
    ORDER BY obs_date DESC, resource_id DESC
  ) = 1
),

/* Pivot latest lipid values for threshold evaluation */
patient_lipid_profile AS (
  SELECT 
    PATIENT_ID,
    MAX(CASE WHEN lipid_type = 'LDL' THEN value_mg_dl END)          AS ldl_mg_dl,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN value_mg_dl END)   AS total_chol_mg_dl,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN value_mg_dl END)AS tg_mg_dl,

    /* resource/date/source for whichever measurement triggers the flag */
    MAX(CASE WHEN lipid_type = 'LDL' THEN resource_id END)          AS ldl_resource_id,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN resource_id END)   AS total_chol_resource_id,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN resource_id END)AS tg_resource_id,

    MAX(CASE WHEN lipid_type = 'LDL' THEN obs_date END)             AS ldl_date,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN obs_date END)      AS total_chol_date,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN obs_date END)   AS tg_date,

    MAX(CASE WHEN lipid_type = 'LDL' THEN DATA_SOURCE END)          AS ldl_source,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL' THEN DATA_SOURCE END)   AS total_chol_source,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN DATA_SOURCE END)AS tg_source
  FROM latest_lipids
  GROUP BY PATIENT_ID
),

/* Apply MD's sensitive thresholds */
hyperlipidemia_suspects AS (
  SELECT 
    p.PATIENT_ID,

    /* Determine suspect category (priority: LDL, then Total, then TG) */
    CASE 
      WHEN p.ldl_mg_dl      >= 130 THEN 'hyperlipidemia_ldl_130plus'
      WHEN p.total_chol_mg_dl >= 200 THEN 'hyperlipidemia_totalchol_200plus'
      WHEN p.tg_mg_dl       >= 200 THEN 'hyperlipidemia_tg_200plus'
      ELSE NULL
    END AS suspect_group,

    /* Assign ICD-10 for reviewer context (not a diagnosis) */
    CASE 
      WHEN p.ldl_mg_dl      >= 130 THEN 'E78.0'  -- Pure hypercholesterolemia
      WHEN p.total_chol_mg_dl >= 200 THEN 'E78.5'  -- Hyperlipidemia, unspecified
      WHEN p.tg_mg_dl       >= 200 THEN 'E78.1'  -- Pure hyperglyceridemia (hypertriglyceridemia)
      ELSE NULL
    END AS suspect_icd10_code,

    CASE 
      WHEN p.ldl_mg_dl      >= 130 THEN 'Pure hypercholesterolemia (LDL ≥130)'
      WHEN p.total_chol_mg_dl >= 200 THEN 'Hyperlipidemia, unspecified (Total chol ≥200)'
      WHEN p.tg_mg_dl       >= 200 THEN 'Hypertriglyceridemia (TG ≥200)'
      ELSE NULL
    END AS suspect_icd10_short_description,

    /* Primary supporting measurement for FHIR + display */
    CASE 
      WHEN p.ldl_mg_dl      >= 130 THEN p.ldl_resource_id
      WHEN p.total_chol_mg_dl >= 200 THEN p.total_chol_resource_id
      WHEN p.tg_mg_dl       >= 200 THEN p.tg_resource_id
    END AS primary_resource_id,

    CASE 
      WHEN p.ldl_mg_dl      >= 130 THEN p.ldl_date
      WHEN p.total_chol_mg_dl >= 200 THEN p.total_chol_date
      WHEN p.tg_mg_dl       >= 200 THEN p.tg_date
    END AS primary_obs_date,

    CASE 
      WHEN p.ldl_mg_dl      >= 130 THEN p.ldl_source
      WHEN p.total_chol_mg_dl >= 200 THEN p.total_chol_source
      WHEN p.tg_mg_dl       >= 200 THEN p.tg_source
    END AS primary_data_source,

    /* Include values for FHIR/valueQuantity */
    p.ldl_mg_dl,
    p.total_chol_mg_dl,
    p.tg_mg_dl

  FROM patient_lipid_profile p
  WHERE (p.ldl_mg_dl >= 130 OR p.total_chol_mg_dl >= 200 OR p.tg_mg_dl >= 200)
),

/* Build minimal FHIR Observation JSON for the triggering measurement */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

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
              WHEN s.suspect_group = 'hyperlipidemia_ldl_130plus'        THEN s.ldl_mg_dl
              WHEN s.suspect_group = 'hyperlipidemia_totalchol_200plus'  THEN s.total_chol_mg_dl
              WHEN s.suspect_group = 'hyperlipidemia_tg_200plus'         THEN s.tg_mg_dl
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
