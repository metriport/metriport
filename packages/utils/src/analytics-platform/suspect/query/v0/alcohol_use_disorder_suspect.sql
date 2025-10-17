/* ============================================================
   ALCOHOL USE DISORDER — SUSPECT QUERY (Ethanol only)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "alcohol_use_disorder suspects" using blood alcohol level
     (BAL) from LAB_RESULT (LOINC 5643-2), normalizing mixed units
     to mg/dL and applying pragmatic screening thresholds.
   ============================================================ */

WITH aud_dx_exclusion AS (
  /* Patients already diagnosed with alcohol-related disorders (exclude) */
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'F10%'
),

/* -------------------------
   RAW: pull rows, extract numeric, require units
   ------------------------- */
ethanol_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                       AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) AS units_raw,
    /* Extract the first numeric piece (handles "0.08 %", "300 mg/dL", etc.) */
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')   AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                          AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '5643-2'   -- Ethanol [Mass/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    /* Ignore empty units up front */
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) IS NOT NULL
    /* ensure numeric token > 0 */
    AND TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) > 0
),

/* -------------------------
   NORM: normalize value → mg/dL and set canonical units
   ------------------------- */
ethanol_norm AS (
  SELECT
    r.*,
    /* Convert to mg/dL for thresholding */
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%g/dl%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%\%%'    THEN TRY_TO_DOUBLE(r.value_token) * 1000.0   -- % w/v ≈ g/dL
      ELSE NULL
    END AS value_mg_dl,
    /* canonical units for downstream use */
    'mg/dL' AS units
  FROM ethanol_raw r
),

/* -------------------------
   CLEAN: plausibility & diagnosis exclusions
   ------------------------- */
ethanol_clean AS (
  SELECT *
  FROM ethanol_norm n
  WHERE n.value_mg_dl IS NOT NULL
    /* conservative plausibility range for BAL values in mg/dL */
    AND n.value_mg_dl BETWEEN 10 AND 1000
    AND NOT EXISTS (SELECT 1 FROM aud_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: assign screening buckets (tunable)
   ------------------------- */
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

    /* carry-through for FHIR */
    e.resource_id,
    e.resource_type,
    e.NORMALIZED_CODE,
    e.NORMALIZED_DESCRIPTION,
    e.RESULT,
    e.units,                    -- canonical units from NORM
    e.value_mg_dl AS value_num, -- canonical numeric
    e.obs_date,
    e.DATA_SOURCE
  FROM ethanol_clean e
  WHERE e.value_mg_dl >= 80  -- lowest screening threshold
),

/* -------------------------
   FHIR: minimal Observation per supporting BAL
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
          'unit',  s.units
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

/* -------------------------
   RETURN
   ------------------------- */
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
