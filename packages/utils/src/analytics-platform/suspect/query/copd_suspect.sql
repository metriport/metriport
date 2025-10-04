/* ============================================================
   Purpose
   -------
   Flag "COPD suspects" from spirometry results in LAB_RESULT
   using LOINC 19926-5 (FEV1/FVC ratio), while EXCLUDING anyone
   already diagnosed with COPD (J44.*). Emit minimal FHIR so the
   UI can render each supporting lab result.

   Criteria (screening signals; single-observation)
   ------------------------------------------------
   - Airflow obstruction: FEV1/FVC < 0.70
     • If the record appears post-bronchodilator → copd_obstruction_postbd
     • Otherwise (pre/unknown)                  → copd_obstruction_unknown
     (Bronchodilator status is inferred from text if available.)

   Safety / Implementation updates
   --------------------------------
   - Parse numbers from RESULT with REGEXP_SUBSTR (handles "70%", "<=0.68", etc.).
   - Percent handling: if units (or text) suggest percent, divide by 100
     only when the parsed number is in a plausible percent range (>1.2).
     This avoids turning "0.68%"-style entries into 0.0068 by mistake.
   - Plausibility guard keeps ratio in (0, 1.2].
   ============================================================ */

WITH fev1fvc_raw AS (
  /* Pull FEV1/FVC results and extract a numeric token from RESULT */
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                  AS resource_id,
    lr.NORMALIZED_CODE_TYPE,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.SOURCE_DESCRIPTION,
    lr.SOURCE_COMPONENT,
    lr.NORMALIZED_COMPONENT,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    /* Extract the first numeric (handles "70 %", "≤0.68", "0.68 post") */
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                      AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '19926-5'                -- FEV1/FVC ratio
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

fev1fvc_norm AS (
  /* Normalize to a fraction (ratio) for comparison against 0.70 */
  SELECT
    r.PATIENT_ID,
    r.resource_id,
    r.NORMALIZED_CODE,
    r.NORMALIZED_DESCRIPTION,
    r.SOURCE_DESCRIPTION,
    r.SOURCE_COMPONENT,
    r.NORMALIZED_COMPONENT,
    r.RESULT,
    r.units,
    r.obs_date,
    r.DATA_SOURCE,

    /* Parsed numeric */
    TRY_TO_DOUBLE(r.value_token) AS value_clean,

    /* Detect signals of post-/pre-bronchodilator from any text field, incl. RESULT */
    CASE
      WHEN CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_COMPONENT,''), COALESCE(r.SOURCE_COMPONENT,''),
             COALESCE(r.SOURCE_DESCRIPTION,''),  COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%post%bronch%'        OR
           CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_COMPONENT,''), COALESCE(r.SOURCE_COMPONENT,''),
             COALESCE(r.SOURCE_DESCRIPTION,''),  COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%post-bronchodilator%'
        THEN 'post'
      WHEN CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_COMPONENT,''), COALESCE(r.SOURCE_COMPONENT,''),
             COALESCE(r.SOURCE_DESCRIPTION,''),  COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%pre%bronch%'         OR
           CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_COMPONENT,''), COALESCE(r.SOURCE_COMPONENT,''),
             COALESCE(r.SOURCE_DESCRIPTION,''),  COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%pre-bronchodilator%'
        THEN 'pre'
      ELSE 'unknown'
    END AS bd_status,

    /* Normalize numeric to fraction:
       - If units (or value style) suggest percent, divide by 100
         only when the number clearly looks like a percent (>1.2).
       - Otherwise treat as already a ratio. */
    CASE
      WHEN (r.units ILIKE '%\%%' OR r.units ILIKE '%percent%' OR r.units ILIKE '%pct%')
           AND TRY_TO_DOUBLE(r.value_token) > 1.2
        THEN TRY_TO_DOUBLE(r.value_token) / 100.0
      WHEN TRY_TO_DOUBLE(r.value_token) > 1.2 AND TRY_TO_DOUBLE(r.value_token) <= 100
        THEN TRY_TO_DOUBLE(r.value_token) / 100.0
      ELSE TRY_TO_DOUBLE(r.value_token)
    END AS fev1fvc_ratio
  FROM fev1fvc_raw r
),

copd_dx_exclusion AS (
  /* Exclude anyone already diagnosed with COPD */
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'J44.%'
),

copd_suspects AS (
  /* Apply threshold and emit suspect groups */
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    n.units,
    n.fev1fvc_ratio AS value_num,          -- normalized ratio
    n.obs_date,
    n.DATA_SOURCE,

    CASE
      WHEN n.fev1fvc_ratio < 0.70 AND n.bd_status = 'post' THEN 'copd_obstruction_postbd'
      WHEN n.fev1fvc_ratio < 0.70                           THEN 'copd_obstruction_unknown'
      ELSE NULL
    END AS suspect_group,

    /* Suspect target diagnosis label (not a diagnosis by itself) */
    'J44.9' AS suspect_icd10_code,
    'Chronic obstructive pulmonary disease, unspecified' AS suspect_icd10_short_description

  FROM fev1fvc_norm n
  WHERE n.fev1fvc_ratio > 0     -- plausibility guard
    AND n.fev1fvc_ratio <= 1.2  -- conservative upper bound
    AND NOT EXISTS (SELECT 1 FROM copd_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* Build the minimal FHIR Observation JSON the UI reads */
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
          'unit',  'ratio'                 -- normalized to fraction for comparison
        ),
      /* Preserve the original display value if it wasn't a plain number */
      'valueString',
        IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    'Observation' AS resource_type,
    s.DATA_SOURCE AS data_source
  FROM copd_suspects s
)

SELECT
  /* Final grouping per patient and COPD evidence bucket */
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
