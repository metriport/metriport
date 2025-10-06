/* ============================================================
   CKD SUSPECTS — Return Only the HIGHEST Stage per Patient
   ------------------------------------------------------------
   Purpose:
     Use three evidence paths:
       (A) eGFR stage (two-date rule per stage),
       (B) Albuminuria ACR > 30 mg/g (unit-restricted),
       (C) Dialysis procedures (treat as Stage 5),
     excluding known CKD (N18.*), and then emit ONLY the single
     highest CKD stage per patient (e.g., if Stage 5 exists, do not
     also output Stage 3).

   Notes:
     - Severity order (worst → best):
         ckd_stage5 (incl. dialysis) >
         ckd_stage4 >
         ckd_stage3b >
         ckd_stage3a >
         ckd_albuminuria  (treated as stage 2 signal)
     - FHIR payload:
         Observation for lab-based evidence,
         Procedure for dialysis evidence.
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
  /* Map each qualifying eGFR result to a CKD stage bucket */
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
  /* Require ≥2 distinct dates within the SAME eGFR stage bucket */
  SELECT
    patient_id,
    stage_bucket
  FROM egfr_staged
  WHERE stage_bucket IS NOT NULL
  GROUP BY patient_id, stage_bucket
  HAVING COUNT(DISTINCT obs_date) >= 2
),

ckd_dx_exclusion AS (
  /* Exclude anyone already diagnosed with CKD (any N18.*) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'N18%'
),

/* eGFR-based CKD suspects that satisfy the two-date rule */
ckd_flags_egfr AS (
  SELECT
    s.PATIENT_ID,
    'Observation'          AS resource_type,
    s.resource_id,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.RESULT,
    s.units,
    s.egfr               AS value_num,     -- numeric value for FHIR builder
    s.obs_date,
    s.DATA_SOURCE,
    s.stage_bucket       AS suspect_group,
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

/* Albuminuria raw pulls (LOINC 9318-7), restricted to approved mg/g variants */
albumin_lab AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                          AS resource_id,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    LOWER(TRIM(COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS))) AS units_lc,
    TRY_TO_DOUBLE(lr.RESULT)                  AS value_raw,
    CAST(lr.RESULT_DATE AS DATE)              AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '9318-7'
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND LOWER(TRIM(COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS))) IN
        ('mg/g', 'mg/g creat', 'mg/g{creat}', 'mg/g_creat', 'mg/g creat')
),

/* Normalize ACR to mg/g (no numeric conversion needed for these variants) */
albumin_norm AS (
  SELECT
    a.PATIENT_ID,
    a.resource_id,
    a.NORMALIZED_CODE,
    a.NORMALIZED_DESCRIPTION,
    a.RESULT,
    'mg/g'                          AS units,     -- cast to mg/g for output
    a.value_raw                     AS acr_mgg,   -- already mg/g-equivalent
    a.obs_date,
    a.DATA_SOURCE
  FROM albumin_lab a
),

/* Albuminuria-based CKD suspects: ACR > 30 mg/g
   TODO (per MD): enforce persistence ≥ 3 months (e.g., two dates ≥90d apart). */
ckd_flags_albuminuria AS (
  SELECT
    n.PATIENT_ID,
    'Observation'                   AS resource_type,
    n.resource_id,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    n.units,
    n.acr_mgg AS value_num,          -- normalized numeric value (mg/g)
    n.obs_date,
    n.DATA_SOURCE,
    'ckd_albuminuria'                 AS suspect_group,
    'N18.2'                           AS suspect_icd10_code,
    'Chronic kidney disease, stage 2' AS suspect_icd10_short_description
  FROM albumin_norm n
  WHERE n.acr_mgg > 30
    AND NOT EXISTS (SELECT 1 FROM ckd_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -----------------------------------------------------------------
   (C) Dialysis-based stage 5 CKD (code list may be SNOMED/CPT/etc.)
   ----------------------------------------------------------------- */
dialysis_code_list AS (
  SELECT column1 AS NORMALIZED_CODE
  FROM VALUES
    -- EXAMPLE place-holders (replace with your full list/table)
    ('90937'), ('302497006'), ('90935')
),

dialysis_procedures AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID          AS resource_id,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM PROCEDURE p
  JOIN dialysis_code_list d
    ON p.NORMALIZED_CODE = d.NORMALIZED_CODE
),

ckd_flags_dialysis AS (
  SELECT
    dp.PATIENT_ID,
    'Procedure'                    AS resource_type,
    dp.resource_id,
    dp.NORMALIZED_CODE,
    dp.NORMALIZED_DESCRIPTION,
    NULL                           AS RESULT,
    NULL                           AS units,
    NULL                           AS value_num,
    dp.obs_date,
    dp.DATA_SOURCE,
    'ckd_stage5'                   AS suspect_group,
    'N18.5'                        AS suspect_icd10_code,
    'Chronic kidney disease, stage 5' AS suspect_icd10_short_description
  FROM dialysis_procedures dp
  WHERE NOT EXISTS (SELECT 1 FROM ckd_dx_exclusion x WHERE x.PATIENT_ID = dp.PATIENT_ID)
),

/* ---------------------------
   Combine all CKD evidence
   --------------------------- */
all_ckd_flags AS (
  SELECT * FROM ckd_flags_egfr
  UNION ALL
  SELECT * FROM ckd_flags_albuminuria
  UNION ALL
  SELECT * FROM ckd_flags_dialysis
),

/* ------------------------------------------------------------
   PICK ONLY THE HIGHEST SEVERITY PER PATIENT
   ------------------------------------------------------------
   Map each bucket to a severity rank (1 = worst):
      ckd_stage5 -> 1
      ckd_stage4 -> 2
      ckd_stage3b -> 3
      ckd_stage3a -> 4
      ckd_albuminuria -> 5
   Then pick the MIN(severity_rank) per patient and keep only rows
   whose suspect_group matches that highest-severity bucket.
   ------------------------------------------------------------ */
ranked_flags AS (
  SELECT
    f.*,
    CASE f.suspect_group
      WHEN 'ckd_stage5'      THEN 1
      WHEN 'ckd_stage4'      THEN 2
      WHEN 'ckd_stage3b'     THEN 3
      WHEN 'ckd_stage3a'     THEN 4
      WHEN 'ckd_albuminuria' THEN 5
      ELSE 99
    END AS severity_rank
  FROM all_ckd_flags f
),

highest_bucket_per_patient AS (
  SELECT
    PATIENT_ID,
    MIN(severity_rank) AS best_rank
  FROM ranked_flags
  GROUP BY PATIENT_ID
),

highest_ckd_flags AS (
  /* Keep only resources that belong to the highest-severity bucket */
  SELECT rf.*
  FROM ranked_flags rf
  JOIN highest_bucket_per_patient hb
    ON hb.PATIENT_ID = rf.PATIENT_ID
   AND hb.best_rank  = rf.severity_rank
),

/* ------------------------------------------------------------
   Build minimal FHIR for the kept (highest) evidence only
   ------------------------------------------------------------ */
obs_with_fhir AS (
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,

    CASE
      WHEN f.resource_type = 'Observation' THEN
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
            OBJECT_CONSTRUCT(
              'value', f.value_num,
              'unit',
                CASE
                  WHEN f.suspect_group = 'ckd_albuminuria' THEN 'mg/g'
                  ELSE COALESCE(NULLIF(f.units,''), 'mL/min/1.73 m2')
                END
            )
        )
      ELSE
        OBJECT_CONSTRUCT(
          'resourceType', 'Procedure',
          'id',            f.resource_id,
          'status',        'completed',
          'code', OBJECT_CONSTRUCT(
            'text',   NULLIF(f.NORMALIZED_DESCRIPTION, ''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system',  NULL,  -- fill with your coding system if available
                'code',    f.NORMALIZED_CODE,
                'display', f.NORMALIZED_DESCRIPTION
              )
            )
          ),
          'performedDateTime', TO_CHAR(f.obs_date, 'YYYY-MM-DD')
        )
    END AS fhir,

    f.resource_id,
    f.resource_type,
    f.DATA_SOURCE AS data_source
  FROM highest_ckd_flags f
)

SELECT
  /* Final output: ONE bucket per patient (highest severity), with all
     supporting resources that belong to that bucket */
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,  -- "Observation" or "Procedure"
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
