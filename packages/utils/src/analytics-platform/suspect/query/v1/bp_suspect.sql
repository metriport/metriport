/* ============================================================
   HYPERTENSION — SUSPECT QUERY (BP Observations) — NEW SCHEMAS
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "hypertension suspects" from discrete BP observations:
       - 8480-6: Systolic blood pressure
       - 8462-4: Diastolic blood pressure
     while excluding anyone already diagnosed with HTN (I10–I15).

   Staging thresholds (single-observation labeling):
     - Stage 2 HTN: SBP ≥ 140  OR  DBP ≥ 90
     - Stage 1 HTN: SBP 130–139 OR DBP 80–89

   New schemas used:
     • OBSERVATION  (LOINC_CODE, LOINC_DISPLAY, RESULT, UNITS, START_DATE)
     • CONDITION    (ICD_10_CM_CODE)
   ============================================================ */

WITH htn_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE LEFT(c.ICD_10_CM_CODE, 3) IN ('I10','I11','I12','I13','I15')
),

/* -------------------------
   RAW: pull rows, extract numeric, require units
   ------------------------- */
bp_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                            AS RESULT,
    o.UNITS                                                            AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE o.LOINC_CODE IN ('8480-6','8462-4')
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS, '') IS NOT NULL
    AND TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) > 0
),

/* -------------------------
   NORM: keep only mmHg variants; canonicalize to mmHg
   (drop everything else by leaving value_mmhg NULL)
   ------------------------- */
bp_norm AS (
  SELECT
    r.*,
    CASE
      /* Normalize mm/Hg, mm Hg, mm[Hg], mmHg (strip non-letters, compare to 'mmhg') */
      WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z]', '') = 'mmhg' THEN 'mmHg'
      ELSE NULL
    END AS units_disp,
    CASE
      WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z]', '') = 'mmhg'
        THEN TRY_TO_DOUBLE(r.value_token)
      ELSE NULL
    END AS value_mmhg
  FROM bp_raw r
),

/* -------------------------
   CLEAN: keep plausible, canonicalized rows; drop known HTN dx
   ------------------------- */
bp_clean AS (
  SELECT *
  FROM bp_norm n
  WHERE n.value_mmhg IS NOT NULL
    AND n.value_mmhg >= 80
    AND n.value_mmhg <= 250
    AND n.units_disp IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM htn_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: assign stage buckets (stage2 precedence)
   ------------------------- */
bp_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.LOINC_CODE = '8480-6' AND c.value_mmhg >= 140 THEN 'stage2_systolic'
      WHEN c.LOINC_CODE = '8462-4' AND c.value_mmhg >=  90 THEN 'stage2_diastolic'
      WHEN c.LOINC_CODE = '8480-6' AND c.value_mmhg BETWEEN 130 AND 139 THEN 'stage1_systolic'
      WHEN c.LOINC_CODE = '8462-4' AND c.value_mmhg BETWEEN  80 AND  89 THEN 'stage1_diastolic'
      ELSE NULL
    END AS suspect_group,

    'I10'  AS suspect_icd10_code,
    'Essential (primary) hypertension' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units_disp AS units,         -- canonical output
    c.value_mmhg AS value_num,     -- canonical numeric
    c.obs_date,
    c.DATA_SOURCE
  FROM bp_clean c
  WHERE
    ( (c.LOINC_CODE = '8480-6' AND c.value_mmhg >= 130)   -- systolic thresholds
      OR
      (c.LOINC_CODE = '8462-4' AND c.value_mmhg >= 80) )  -- diastolic thresholds
),

/* -------------------------
   FHIR
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
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.LOINC_CODE,
            'display',  s.LOINC_DISPLAY
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  'mmHg'
      ),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM bp_suspects s
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
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
