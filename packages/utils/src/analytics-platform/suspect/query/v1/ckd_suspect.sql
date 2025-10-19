/* ============================================================
   CHRONIC KIDNEY DISEASE (CKD) — SUSPECT QUERY
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Use three evidence paths:
       (A) eGFR stage (two-date rule within stage),
       (B) Albuminuria (ACR > 30 mg/g),
       (C) Dialysis procedures (treat as Stage 5),
     excluding known CKD (N18.*), then emit ONLY the single
     highest-severity CKD bucket per patient.

   New schemas used:
     • CORE__CONDITION   (ICD_10_CM_CODE)
     • CORE__OBSERVATION (LOINC_CODE / RESULT / UNITS / START_DATE)
     • CORE__PROCEDURE   (CPT_CODE / CPT_DISPLAY / START_DATE)
   ============================================================ */

WITH ckd_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'N18%'
),

/* -------------------------
   RAW: eGFR labs (numeric token required; units present)
   LOINCs: 33914-3, 62238-1, 69405-9, 98979-8
   ------------------------- */
egfr_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                               AS resource_id,
    'Observation'                                                  AS resource_type,
    o.LOINC_CODE                                                   AS NORMALIZED_CODE,
    o.LOINC_DISPLAY                                                AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS                                                        AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE IN ('33914-3','62238-1','69405-9','98979-8')
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

/* -------------------------
   RAW: Albumin/Creatinine Ratio (ACR) labs (numeric token; units present)
   LOINC: 9318-7
   ------------------------- */
albumin_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                               AS resource_id,
    'Observation'                                                  AS resource_type,
    o.LOINC_CODE                                                   AS NORMALIZED_CODE,
    o.LOINC_DISPLAY                                                AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS                                                        AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE = '9318-7'
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

/* -------------------------
   RAW: Dialysis procedures (treat as stage 5)
   (CPT; SNOMED-only primary code path not available in CORE__PROCEDURE)
   ------------------------- */
dialysis_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                              AS resource_id,
    'Procedure'                                 AS resource_type,
    p.CPT_CODE                                   AS NORMALIZED_CODE,
    p.CPT_DISPLAY                                AS NORMALIZED_DESCRIPTION,
    CAST(p.START_DATE AS DATE)                  AS obs_date,
    p.DATA_SOURCE
  FROM CORE__PROCEDURE p
  WHERE p.CPT_CODE IN ('90935','90937')
),

/* -------------------------
   NORM: eGFR → canonical value (accept common mL/min[/1.73 m2] variants)
   ------------------------- */
egfr_norm AS (
  SELECT
    r.*,
    /* compact units key (e.g., 'mlmin173m2', 'mlminm2', 'mlmin') */
    REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') AS units_key,
    TRY_TO_NUMBER(r.value_token)                                      AS value_num_raw
  FROM egfr_raw r
),
egfr_units AS (
  SELECT
    *,
    CASE
      WHEN (units_key LIKE 'mlmin%' AND (units_key LIKE '%173%' OR units_key LIKE '%m2%'))
        THEN value_num_raw
      WHEN units_key = 'mlmin'
        THEN value_num_raw
      ELSE NULL
    END AS value_egfr,
    'mL/min/1.73 m2' AS units
  FROM egfr_norm
),

/* -------------------------
   NORM: ACR → normalize to mg/g, handle common variants
   ------------------------- */
albumin_norm AS (
  SELECT
    r.*,
    LOWER(COALESCE(r.units_raw,'')) AS ukey,
    TRY_TO_NUMBER(r.value_token)    AS acr_raw
  FROM albumin_raw r
),
albumin_units AS (
  SELECT
    *,
    CASE
      WHEN ukey LIKE '%mg/g%'                   THEN acr_raw                /* mg/g */
      WHEN ukey LIKE '%ug/mg%' OR ukey LIKE '%mcg/mg%' THEN acr_raw        /* μg/mg ≡ mg/g */
      WHEN ukey LIKE '%mg/mg%'                  THEN acr_raw * 1000.0       /* mg/mg → mg/g */
      ELSE NULL
    END AS acr_mgg,
    'mg/g' AS units
  FROM albumin_norm
),

/* -------------------------
   CLEAN: apply plausibility & CKD diagnosis exclusions
   ------------------------- */
egfr_clean AS (
  SELECT u.*
  FROM egfr_units u
  LEFT JOIN ckd_dx_exclusion x ON x.PATIENT_ID = u.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
    AND u.value_egfr IS NOT NULL
    AND u.value_egfr BETWEEN 0 AND 200
    AND u.value_egfr < 60
),
albumin_clean AS (
  SELECT u.*
  FROM albumin_units u
  LEFT JOIN ckd_dx_exclusion x ON x.PATIENT_ID = u.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
    AND u.acr_mgg IS NOT NULL
    AND u.acr_mgg > 30
    AND u.acr_mgg <= 5000
    AND u.units = 'mg/g'
),
dialysis_clean AS (
  SELECT d.*
  FROM dialysis_raw d
  LEFT JOIN ckd_dx_exclusion x ON x.PATIENT_ID = d.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* -------------------------
   SUSPECT (A): eGFR stage mapping + two-date rule (within stage)
   ------------------------- */
egfr_stage_map AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_egfr AS value_num,
    c.obs_date,
    c.DATA_SOURCE,
    CASE
      WHEN c.value_egfr < 15              THEN 'ckd_stage5'
      WHEN c.value_egfr BETWEEN 15 AND 29 THEN 'ckd_stage4'
      WHEN c.value_egfr BETWEEN 30 AND 44 THEN 'ckd_stage3b'
      WHEN c.value_egfr BETWEEN 45 AND 59 THEN 'ckd_stage3a'
      ELSE NULL
    END AS suspect_group
  FROM egfr_clean c
),
egfr_two_date_patients AS (
  SELECT PATIENT_ID, suspect_group
  FROM egfr_stage_map
  WHERE suspect_group IS NOT NULL
  GROUP BY PATIENT_ID, suspect_group
  HAVING COUNT(DISTINCT obs_date) >= 2
),
egfr_suspects AS (
  SELECT
    m.PATIENT_ID,
    m.resource_type,
    m.resource_id,
    m.NORMALIZED_CODE,
    m.NORMALIZED_DESCRIPTION,
    m.RESULT,
    m.units,
    m.value_num,
    m.obs_date,
    m.DATA_SOURCE,
    m.suspect_group,
    CASE m.suspect_group
      WHEN 'ckd_stage3a' THEN 'N18.31'
      WHEN 'ckd_stage3b' THEN 'N18.32'
      WHEN 'ckd_stage4'  THEN 'N18.4'
      WHEN 'ckd_stage5'  THEN 'N18.5'
    END AS suspect_icd10_code,
    CASE m.suspect_group
      WHEN 'ckd_stage3a' THEN 'Chronic kidney disease, stage 3a'
      WHEN 'ckd_stage3b' THEN 'Chronic kidney disease, stage 3b'
      WHEN 'ckd_stage4'  THEN 'Chronic kidney disease, stage 4'
      WHEN 'ckd_stage5'  THEN 'Chronic kidney disease, stage 5'
    END AS suspect_icd10_short_description
  FROM egfr_stage_map m
  JOIN egfr_two_date_patients t
    ON t.PATIENT_ID = m.PATIENT_ID
   AND t.suspect_group = m.suspect_group
),

/* -------------------------
   SUSPECT (B): Albuminuria > 30 mg/g (treat as stage 2 signal)
   ------------------------- */
albumin_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_type,
    c.resource_id,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.acr_mgg AS value_num,
    c.obs_date,
    c.DATA_SOURCE,
    'ckd_albuminuria'                 AS suspect_group,
    'N18.2'                           AS suspect_icd10_code,
    'Chronic kidney disease, stage 2' AS suspect_icd10_short_description
  FROM albumin_clean c
),

/* -------------------------
   SUSPECT (C): Dialysis (treat as Stage 5)
   ------------------------- */
dialysis_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_type,
    c.resource_id,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    NULL        AS RESULT,
    NULL        AS units,
    NULL        AS value_num,
    c.obs_date,
    c.DATA_SOURCE,
    'ckd_stage5'                        AS suspect_group,
    'N18.5'                             AS suspect_icd10_code,
    'Chronic kidney disease, stage 5'   AS suspect_icd10_short_description
  FROM dialysis_clean c
),

/* -------------------------
   Combine all suspects
   ------------------------- */
all_ckd_suspects AS (
  SELECT * FROM egfr_suspects
  UNION ALL
  SELECT * FROM albumin_suspects
  UNION ALL
  SELECT * FROM dialysis_suspects
),

/* -------------------------
   Rank severity and keep ONLY highest bucket per patient
   ------------------------- */
ranked_ckd AS (
  SELECT
    s.*,
    CASE s.suspect_group
      WHEN 'ckd_stage5'      THEN 1
      WHEN 'ckd_stage4'      THEN 2
      WHEN 'ckd_stage3b'     THEN 3
      WHEN 'ckd_stage3a'     THEN 4
      WHEN 'ckd_albuminuria' THEN 5
      ELSE 99
    END AS severity_rank
  FROM all_ckd_suspects s
),
highest_bucket AS (
  SELECT PATIENT_ID, MIN(severity_rank) AS best_rank
  FROM ranked_ckd
  GROUP BY PATIENT_ID
),
highest_ckd_suspects AS (
  SELECT r.*
  FROM ranked_ckd r
  JOIN highest_bucket hb
    ON hb.PATIENT_ID = r.PATIENT_ID
   AND hb.best_rank  = r.severity_rank
),

/* -------------------------
   FHIR
   ------------------------- */
ckd_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    CASE
      WHEN s.resource_type = 'Observation' THEN
        OBJECT_CONSTRUCT(
          'resourceType', 'Observation',
          'id',            s.resource_id,
          'status',        'final',
          'code', OBJECT_CONSTRUCT(
            'text',   NULLIF(s.NORMALIZED_DESCRIPTION, ''),
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
              'unit',
                CASE
                  WHEN s.suspect_group = 'ckd_albuminuria' THEN 'mg/g'
                  ELSE 'mL/min/1.73 m2'
                END
            ),
          'valueString', IFF(TRY_TO_NUMBER(s.RESULT) IS NULL, s.RESULT, NULL)
        )
      ELSE
        OBJECT_CONSTRUCT(
          'resourceType', 'Procedure',
          'id',            s.resource_id,
          'status',        'completed',
          'code', OBJECT_CONSTRUCT(
            'text',   NULLIF(s.NORMALIZED_DESCRIPTION, ''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system',  'http://www.ama-assn.org/go/cpt',
                'code',     s.NORMALIZED_CODE,
                'display',  s.NORMALIZED_DESCRIPTION
              )
            )
          ),
          'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
        )
    END AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM highest_ckd_suspects s
)

/* -------------------------
   RETURN
   ------------------------- */
SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,   -- Observation or Procedure
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM ckd_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
