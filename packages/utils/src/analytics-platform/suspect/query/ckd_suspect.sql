/* ============================================================
   Purpose
   -------
   Flag "CKD suspects" from eGFR lab results (LAB_RESULT) using
   specific eGFR LOINC codes, with stage thresholds and the
   requirement that values are observed on ≥2 different dates
   (not on the same day) for the SAME stage. Exclude patients
   already diagnosed with CKD (N18.*). Emit minimal FHIR so the UI
   can render each supporting lab result.

   Codes used (eGFR LOINC in LAB_RESULT)
   -------------------------------------
   - 33914-3   eGFR (MDRD)
   - 62238-1   eGFR (CKD-EPI creatinine)
   - 69405-9   eGFR (CKD-EPI cystatin C)
   - 98979-8   eGFR (CKD-EPI 2021 creatinine+cystatin C)

   Stage thresholds (mL/min/1.73 m²)
   ----------------------------------
   - 45–59  -> ckd_stage3a   (ICD-10 N18.31)
   - 30–44  -> ckd_stage3b   (ICD-10 N18.32)
   - 15–29  -> ckd_stage4    (ICD-10 N18.4)
   - < 15   -> ckd_stage5    (ICD-10 N18.5)

   Safety / Implementation
   -----------------------
   - Uses TRY_TO_DOUBLE(...) to avoid errors on non-numeric RESULT.
   - Plausibility guard keeps eGFR in [0, 200].
   - Two-date rule applied per stage bucket (distinct RESULT_DATEs).
   - Minimal FHIR Observation is embedded in responsible_resources.
   ============================================================ */

WITH egfr_lab AS (
  /* eGFR numeric values from LAB_RESULT for the specified LOINCs */
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                          AS resource_id,
    lr.NORMALIZED_CODE_TYPE,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    TRY_TO_DOUBLE(lr.RESULT)                  AS egfr,
    CAST(lr.RESULT_DATE AS DATE)              AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('33914-3','62238-1','69405-9','98979-8')
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND TRY_TO_DOUBLE(lr.RESULT) BETWEEN 0 AND 200
),

egfr_staged AS (
  /* Map each qualifying result to a CKD stage bucket */
  SELECT
    e.PATIENT_ID,
    e.resource_id,
    e.NORMALIZED_CODE,
    e.NORMALIZED_DESCRIPTION,
    e.RESULT,
    e.units,
    e.egfr,
    e.obs_date,
    e.DATA_SOURCE,
    CASE
      WHEN e.egfr < 15                      THEN 'ckd_stage5'
      WHEN e.egfr BETWEEN 15 AND 29         THEN 'ckd_stage4'
      WHEN e.egfr BETWEEN 30 AND 44         THEN 'ckd_stage3b'
      WHEN e.egfr BETWEEN 45 AND 59         THEN 'ckd_stage3a'
      ELSE NULL
    END AS stage_bucket
  FROM egfr_lab e
  WHERE e.egfr < 60
),

valid_stage_patients AS (
  /* Require ≥2 distinct dates within the SAME stage bucket */
  SELECT
    patient_id,
    stage_bucket
  FROM egfr_staged
  WHERE stage_bucket IS NOT NULL
  GROUP BY patient_id, stage_bucket
  HAVING COUNT(DISTINCT obs_date) >= 2
),

ckd_dx_exclusion AS (
  /* Exclude anyone already diagnosed with CKD */
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'N18.%'
),

ckd_flags AS (
  /* Emit stage-labeled rows only for patients meeting the two-date rule and no existing CKD dx */
  SELECT
    s.PATIENT_ID,
    s.resource_id,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.RESULT,
    s.units,
    s.egfr,
    s.obs_date,
    s.DATA_SOURCE,
    s.stage_bucket                                 AS suspect_group,
    CASE
      WHEN s.stage_bucket = 'ckd_stage3a' THEN 'N18.31'
      WHEN s.stage_bucket = 'ckd_stage3b' THEN 'N18.32'
      WHEN s.stage_bucket = 'ckd_stage4'  THEN 'N18.4'
      WHEN s.stage_bucket = 'ckd_stage5'  THEN 'N18.5'
    END AS suspect_icd10_code,
    CASE
      WHEN s.stage_bucket = 'ckd_stage3a' THEN 'Chronic kidney disease, stage 3a'
      WHEN s.stage_bucket = 'ckd_stage3b' THEN 'Chronic kidney disease, stage 3b'
      WHEN s.stage_bucket = 'ckd_stage4'  THEN 'Chronic kidney disease, stage 4'
      WHEN s.stage_bucket = 'ckd_stage5'  THEN 'Chronic kidney disease, stage 5'
    END AS suspect_icd10_short_description
  FROM egfr_staged s
  JOIN valid_stage_patients v
    ON v.patient_id   = s.patient_id
   AND v.stage_bucket = s.stage_bucket
  WHERE s.stage_bucket IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ckd_dx_exclusion x WHERE x.PATIENT_ID = s.PATIENT_ID)
),

/* Build the minimal FHIR Observation JSON the UI reads */
obs_with_fhir AS (
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            f.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(f.NORMALIZED_DESCRIPTION, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     f.NORMALIZED_CODE,
            'display',  f.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(f.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(f.egfr IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', f.egfr,
              /* Use lab units if present; otherwise default common eGFR unit text */
              'unit',  COALESCE(NULLIF(f.units,''), 'mL/min/1.73 m2')
            ),
            NULL),
      'valueString',
        IFF(f.egfr IS NULL, f.RESULT, NULL)
    ) AS fhir,

    f.resource_id,
    'Observation' AS resource_type,
    f.DATA_SOURCE AS data_source
  FROM ckd_flags f
)

SELECT
  /* Final grouping per patient and CKD stage */
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  /* Aggregate supporting lab results with FHIR payloads */
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
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;