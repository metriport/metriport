/* ============================================================
   MAJOR DEPRESSION — SUSPECT QUERY (PHQ-9 / PHQ-2)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "depression_screen_positive" suspects using PHQ totals:
       • PHQ-9 total (44261-6)  ≥ 10  → depression_phq9_10plus
       • PHQ-2 total (55758-7)  ≥ 3   → depression_phq2_3plus
     Exclude patients already diagnosed with depressive disorders.
   ============================================================ */

WITH depression_dx_exclusion AS (
  /* Exclude existing depression diagnoses */
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND (
      c.NORMALIZED_CODE LIKE 'F32%'   -- MDD, single episode (incl. F32.A)
      OR c.NORMALIZED_CODE LIKE 'F33%'-- MDD, recurrent
      OR c.NORMALIZED_CODE = 'F341'  -- Dysthymia
    )
),

/* -------------------------
   RAW: PHQ totals from OBSERVATION (numeric token required)
   ------------------------- */
phq_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                              AS resource_id,
    'Observation'                                                 AS resource_type,
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.RESULT,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.OBSERVATION_DATE AS DATE)                              AS obs_date,
    o.DATA_SOURCE
  FROM core_v2.CORE_V2__OBSERVATION o
  WHERE o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE IN ('44261-6','55758-7')  -- PHQ-9 total, PHQ-2 total
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM: numeric score + canonical unit
   ------------------------- */
phq_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_score,
    'score'                      AS units,
  FROM phq_raw r
),

/* -------------------------
   CLEAN: plausibility + exclude known dx
   ------------------------- */
phq_clean AS (
  SELECT *
  FROM phq_norm n
  WHERE n.value_score IS NOT NULL
    AND (
      (n.NORMALIZED_CODE = '44261-6' AND n.value_score BETWEEN 0 AND 27)  -- PHQ-9 range
      OR
      (n.NORMALIZED_CODE = '55758-7' AND n.value_score BETWEEN 0 AND 6)   -- PHQ-2 range
    )
    AND NOT EXISTS (SELECT 1 FROM depression_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: apply PHQ thresholds
   ------------------------- */
phq_suspects AS (
  SELECT
    c.PATIENT_ID,
    /* bucket by code + cutoff */
    CASE
      WHEN c.NORMALIZED_CODE = '44261-6' AND c.value_score >= 10 THEN 'depression_phq9_10plus'
      WHEN c.NORMALIZED_CODE = '55758-7' AND c.value_score >= 3  THEN 'depression_phq2_3plus'
      ELSE NULL
    END AS suspect_group,

    /* ICD-10 context for reviewers (not a diagnosis) */
    'F32.A' AS suspect_icd10_code,
    'Depression, unspecified (screen positive)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_score AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM phq_clean c
  WHERE
    (c.NORMALIZED_CODE = '44261-6' AND c.value_score >= 10)
    OR
    (c.NORMALIZED_CODE = '55758-7' AND c.value_score >= 3)
),

/* -------------------------
   FHIR: minimal Observation per supporting PHQ result
   ------------------------- */
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
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  s.units
      ),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM phq_suspects s
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
      'resource_type', resource_type,
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
