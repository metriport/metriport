/* ============================================================
   ALCOHOL USE DISORDER — SUSPECT QUERY (Ethanol only)
   ------------------------------------------------------------
   Purpose
     Flag "alcohol_use_disorder suspects" using blood alcohol level
     (BAL) from LAB_RESULT (LOINC 5643-2), normalizing mixed units
     to mg/dL and applying pragmatic screening thresholds.

   Data signals (single-observation; screening, not diagnosis)
     • LOINC 5643-2  Ethanol [Mass/volume] in Serum/Plasma
     • Units seen in data: mg/dL, g/dL, %, (and some invalid like U/L)

   Unit normalization → mg/dL
     • mg/dL     → value as-is
     • g/dL      → value * 1000
     • % (w/v)   → value * 1000      -- e.g., 0.08% ≈ 80 mg/dL
     • Others / empty units → ignored

   Suggested screening buckets (tunable)
     • ≥ 300 mg/dL → alcohol_very_high_300plus
     • 200–299     → alcohol_high_200plus
     • 80–199      → alcohol_positive_80plus       (≈ legal intoxication)
     (All are “suspect” signals; clinical diagnosis requires more context.)

   Exclusions
     • Patients already diagnosed with alcohol-related disorders:
       ICD-10-CM F10.*  → exclude from suspects

   Output
     • One row per patient × suspect_group
     • Minimal FHIR Observation for UI rendering
   ============================================================ */

WITH aud_dx_exclusion AS (
  /* Patients already diagnosed with alcohol-related disorders (exclude) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'F10.%'
),

/* ------------------------------------------------------------
   Pull ethanol rows and extract a numeric token from RESULT
   ------------------------------------------------------------ */
ethanol_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                  AS resource_id,
    'Observation'                                     AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    /* Extract the first numeric piece (handles "0.08 %", "300 mg/dL", etc.) */
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                      AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '5643-2'   -- Ethanol [Mass/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    /* Ignore empty units up front */
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) IS NOT NULL
),

/* ------------------------------------------------------------
   Normalize units to mg/dL; drop non mass/volume or odd units
   ------------------------------------------------------------ */
ethanol_norm AS (
  SELECT
    r.PATIENT_ID,
    r.resource_id,
    r.resource_type,
    r.NORMALIZED_CODE,
    r.NORMALIZED_DESCRIPTION,
    r.RESULT,
    r.units_raw,
    r.obs_date,
    r.DATA_SOURCE,

    /* Canonicalized units label for display */
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%' THEN 'mg/dL'
      WHEN r.units_raw ILIKE '%g/dl%'  THEN 'g/dL'
      WHEN r.units_raw ILIKE '%\%%'    THEN '%'
      ELSE r.units_raw
    END AS units_disp,

    /* Convert to mg/dL for thresholding */
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%g/dl%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%\%%'    THEN TRY_TO_DOUBLE(r.value_token) * 1000.0   -- % w/v ≈ g/dL
      ELSE NULL
    END AS value_mg_dl
  FROM ethanol_raw r
),

/* ------------------------------------------------------------
   Plausibility filter and exclusion of known AUD diagnoses
   ------------------------------------------------------------ */
ethanol_clean AS (
  SELECT *
  FROM ethanol_norm n
  WHERE value_mg_dl IS NOT NULL
    /* conservative plausibility range for BAL values in mg/dL */
    AND value_mg_dl BETWEEN 10 AND 1000
    AND NOT EXISTS (SELECT 1 FROM aud_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* ------------------------------------------------------------
   Assign suspect buckets based on normalized BAL (mg/dL)
   ------------------------------------------------------------ */
aud_suspects AS (
  SELECT
    e.PATIENT_ID,

    CASE
      WHEN e.value_mg_dl >= 300 THEN 'alcohol_very_high_300plus'
      WHEN e.value_mg_dl >= 200 THEN 'alcohol_high_200plus'
      WHEN e.value_mg_dl >=  80 THEN 'alcohol_positive_80plus'
      ELSE NULL
    END AS suspect_group,

    /* ICD-10 label for reviewer context (not a diagnosis by itself) */
    'F10.9'  AS suspect_icd10_code,
    'Alcohol use, unspecified (screen positive)' AS suspect_icd10_short_description,

    /* Carry through for FHIR building */
    e.resource_id,
    e.resource_type,
    e.NORMALIZED_CODE,
    e.NORMALIZED_DESCRIPTION,
    e.RESULT,
    e.units_disp AS units,
    e.value_mg_dl AS value_num,     -- normalized quantity for FHIR value
    e.obs_date,
    e.DATA_SOURCE
  FROM ethanol_clean e
  WHERE
    (e.value_mg_dl >= 80)  -- lowest screening threshold
),

/* ------------------------------------------------------------
   Minimal FHIR Observation for each supporting BAL
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
          'unit',  'mg/dL'
        ),
      /* Preserve original RESULT if needed (e.g., textual) */
      'valueString',
        IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM aud_suspects s
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
