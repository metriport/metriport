/* ============================================================
   HYPERPARATHYROIDISM — SUSPECT QUERY (PTH + CALCIUM required)
   ------------------------------------------------------------
   Purpose
     Flag "hyperparathyroidism" suspects when BOTH are present:
       (1) Elevated PTH (LOINC 2731-8)  > 65 pg/mL
       (2) Elevated calcium (any of):
            • Total Ca (17861-6)        > 10.5 mg/dL
            • Ionized Ca (1995-0)       > 1.32 mmol/L
            • Ionized Ca (12180-6)      > 5.2 mg/dL
     Exclude patients already diagnosed with hyperparathyroidism (ICD-10 E21.*).

   Notes
     - Unit normalization handled:
       • PTH: pg/mL canonical (ng/mL → *1000; ng/L ≡ pg/mL; pg/mL → as-is)
       • Total Ca: mg/dL canonical (mmol/L → *4.0; mg/dL → as-is)
       • Ionized Ca: use native thresholds by code (mmol/L for 1995-0, mg/dL for 12180-6)
     - Returns one row per patient with both signals; bundles supporting Observations in FHIR.

   Output
     • suspect_group: 'hyperpara_pth_plus_calcium'
     • ICD-10 (review context): E21.3 — Hyperparathyroidism, unspecified
     • responsible_resources: minimal FHIR Observations for the elevated PTH and Ca used
   ============================================================ */

-- Exclude patients already diagnosed with hyperparathyroidism
WITH hyperpara_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'E21%'
),

/* ------------------------------------------------------------
   PTH (2731-8) — normalize to pg/mL
   ------------------------------------------------------------ */
pth_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                          AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '2731-8'  -- Parathyrin.intact (PTH)
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
pth_norm AS (
  SELECT
    r.*,
    /* Canonical unit label for display */
    CASE
      WHEN r.units_raw ILIKE '%pg/ml%' THEN 'pg/mL'
      WHEN r.units_raw ILIKE '%ng/ml%' THEN 'ng/mL'
      WHEN r.units_raw ILIKE '%ng/l%'  THEN 'ng/L'   -- equals pg/mL numerically
      ELSE r.units_raw
    END AS units_disp,
    /* Convert to pg/mL for thresholding */
    CASE
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)           -- 1 ng/L == 1 pg/mL
      ELSE NULL
    END AS pth_pg_ml
  FROM pth_raw r
),
pth_hits AS (
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.resource_type,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    'pg/mL'                    AS units,       -- normalized display unit
    n.pth_pg_ml                AS value_num,   -- numeric for FHIR/value
    n.obs_date,
    n.DATA_SOURCE
  FROM pth_norm n
  WHERE n.pth_pg_ml IS NOT NULL
    AND n.pth_pg_ml > 65
    AND NOT EXISTS (SELECT 1 FROM hyperpara_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY n.PATIENT_ID ORDER BY n.obs_date DESC, n.resource_id DESC) = 1
),

/* ------------------------------------------------------------
   CALCIUM — normalize and apply per-code thresholds
   ------------------------------------------------------------ */
-- Total calcium (17861-6) → mg/dL (mmol/L * 4.0)
total_ca_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                          AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '17861-6'    -- Calcium total
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
total_ca_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%'  THEN 'mg/dL'
      WHEN r.units_raw ILIKE '%mmol/l%' THEN 'mmol/L'
      ELSE r.units_raw
    END AS units_disp,
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%mmol/l%' THEN TRY_TO_DOUBLE(r.value_token) * 4.0
      ELSE NULL
    END AS ca_mg_dl
  FROM total_ca_raw r
),
total_ca_hits AS (
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.resource_type,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    'mg/dL'                  AS units,
    n.ca_mg_dl               AS value_num,
    n.obs_date,
    n.DATA_SOURCE,
    'calcium_total_high'     AS calcium_flag
  FROM total_ca_norm n
  WHERE n.ca_mg_dl IS NOT NULL AND n.ca_mg_dl > 10.5
  QUALIFY ROW_NUMBER() OVER (PARTITION BY n.PATIENT_ID ORDER BY n.obs_date DESC, n.resource_id DESC) = 1
),

-- Ionized calcium (1995-0) → keep mmol/L; threshold 1.32 mmol/L
ion_ca_mmol_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                          AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '1995-0'   -- Ionized Ca (mmol/L)
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
ion_ca_mmol_hits AS (
  SELECT
    r.PATIENT_ID,
    r.resource_id,
    r.resource_type,
    r.NORMALIZED_CODE,
    r.NORMALIZED_DESCRIPTION,
    r.RESULT,
    'mmol/L'                          AS units,
    TRY_TO_DOUBLE(r.value_token)      AS value_num,
    r.obs_date,
    r.DATA_SOURCE,
    'calcium_ionized_high'            AS calcium_flag
  FROM ion_ca_mmol_raw r
  WHERE (r.units_raw ILIKE '%mmol/l%') AND TRY_TO_DOUBLE(r.value_token) > 1.32
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.PATIENT_ID ORDER BY r.obs_date DESC, r.resource_id DESC) = 1
),

-- Ionized calcium by ISE (12180-6) in mg/dL; threshold 5.2 mg/dL
ion_ca_mgdl_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                          AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '12180-6'  -- Ionized Ca by ISE (mg/dL)
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
ion_ca_mgdl_hits AS (
  SELECT
    r.PATIENT_ID,
    r.resource_id,
    r.resource_type,
    r.NORMALIZED_CODE,
    r.NORMALIZED_DESCRIPTION,
    r.RESULT,
    'mg/dL'                                 AS units,
    TRY_TO_DOUBLE(r.value_token)            AS value_num,
    r.obs_date,
    r.DATA_SOURCE,
    'calcium_ionized_high'                  AS calcium_flag
  FROM ion_ca_mgdl_raw r
  WHERE (r.units_raw ILIKE '%mg/dl%') AND TRY_TO_DOUBLE(r.value_token) > 5.2
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.PATIENT_ID ORDER BY r.obs_date DESC, r.resource_id DESC) = 1
),

-- Any qualifying calcium (pick whichever latest per patient among the 3 paths)
calcium_hits_union AS (
  SELECT * FROM total_ca_hits
  UNION ALL
  SELECT * FROM ion_ca_mmol_hits
  UNION ALL
  SELECT * FROM ion_ca_mgdl_hits
),
latest_calcium_per_patient AS (
  SELECT *
  FROM calcium_hits_union
  QUALIFY ROW_NUMBER() OVER (PARTITION BY PATIENT_ID ORDER BY obs_date DESC, resource_id DESC) = 1
),

/* ------------------------------------------------------------
   Patients meeting ESSENTIAL: elevated PTH AND elevated calcium
   ------------------------------------------------------------ */
patients_meeting_essential AS (
  SELECT DISTINCT p.PATIENT_ID
  FROM pth_hits p
  JOIN latest_calcium_per_patient c ON c.PATIENT_ID = p.PATIENT_ID
),

/* ------------------------------------------------------------
   Collect supporting rows (latest elevated PTH + latest elevated Calcium)
   ------------------------------------------------------------ */
supporting_all AS (
  SELECT
    p.PATIENT_ID,
    'hyperpara_pth_plus_calcium'       AS suspect_group,
    'E21.3'                            AS suspect_icd10_code,
    'Hyperparathyroidism, unspecified' AS suspect_icd10_short_description,

    p.resource_id,
    p.resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    p.RESULT,
    p.units,
    p.value_num,
    p.obs_date,
    p.DATA_SOURCE
  FROM pth_hits p
  WHERE p.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)

  UNION ALL

  SELECT
    c.PATIENT_ID,
    'hyperpara_pth_plus_calcium'       AS suspect_group,
    'E21.3'                            AS suspect_icd10_code,
    'Hyperparathyroidism, unspecified' AS suspect_icd10_short_description,

    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM latest_calcium_per_patient c
  WHERE c.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)
),

/* ------------------------------------------------------------
   Minimal FHIR Observation for each supporting lab
   ------------------------------------------------------------ */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        OBJECT_CONSTRUCT(
          'value', s.value_num,
          'unit',  s.units
        ),
      'valueString',
        IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM supporting_all s
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  /* Enriched responsible resources for the UI */
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,  -- "Observation"
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,

  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
