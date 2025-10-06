/* ============================================================
   COPD SCREEN (per MD Essential) — with post-context promotion
   ------------------------------------------------------------
   Purpose
   - Flag rows where the post-bronchodilator (post-BD) FEV1/FVC ratio
     is > 0.70 using LOINC 19926-5 from LAB_RESULT.

   Enhancement
   - Promote 19926-5 rows to POST when the same patient+encounter+date
     has an explicit FEV1 POST result (LOINC 20155-8). This addresses
     labs that label POST on FEV1 but not on the ratio row.

   Exclusions
   - Exclude anyone already diagnosed with COPD (J44.*).

   Safety / Parsing
   - Extract numeric token with REGEXP_SUBSTR (supports "70%", "<=0.68", etc.).
   - Normalize to fraction:
       • If value looks like percent (>1.2 and ≤100) OR units imply percent,
         divide by 100 to get a fraction.
       • Otherwise treat as ratio already.
   - Plausibility guard for the normalized ratio: (0, 1.2].

   Output
   - One row per patient with suspect_group 'copd_postbd_ratio_over_0_70'.
   - Minimal Observation FHIR per supporting lab result.
   ============================================================ */

WITH fev1fvc_raw AS (
  /* Pull candidate FEV1/FVC rows with a numeric token parsed from RESULT */
  SELECT
    lr.PATIENT_ID,
    COALESCE(lr.ENCOUNTER_ID,'')                       AS ENCOUNTER_ID,   -- added for context join
    lr.LAB_RESULT_ID                                    AS resource_id,
    lr.NORMALIZED_CODE_TYPE,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    /* Extract the first numeric chunk (e.g., "70", "0.68", "≤0.68") */
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                      AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '19926-5'                -- FEV1/FVC ratio
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* ------------------------------------------------------------
   Context: explicit FEV1 POST present on the same day/encounter
   ------------------------------------------------------------ */
post_context AS (
  SELECT DISTINCT
    lr.PATIENT_ID,
    COALESCE(lr.ENCOUNTER_ID,'') AS ENCOUNTER_ID,
    CAST(lr.RESULT_DATE AS DATE) AS obs_date
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '20155-8'   -- FEV1 post-bronchodilation
),

fev1fvc_norm AS (
  /* Normalize to fraction and infer/promote bronchodilator status */
  SELECT
    r.PATIENT_ID,
    r.ENCOUNTER_ID,
    r.resource_id,
    r.NORMALIZED_CODE,
    r.NORMALIZED_DESCRIPTION,
    r.RESULT,
    r.units,
    r.obs_date,
    r.DATA_SOURCE,

    /* Parsed numeric */
    TRY_TO_DOUBLE(r.value_token) AS value_clean,

    /* Text-based bronchodilator status (raw) using description/result text */
    CASE
      WHEN CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%post%bronch%' OR
           CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%post-bronchodilator%'
        THEN 'post'
      WHEN CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%pre%bronch%'  OR
           CONCAT_WS(' ',
             COALESCE(r.NORMALIZED_DESCRIPTION,''),
             COALESCE(r.RESULT,'')
           ) ILIKE '%pre-bronchodilator%'
        THEN 'pre'
      ELSE 'unknown'
    END AS bd_status_raw,

    /* Normalize numeric to a fraction for comparison against 0.70.
       - If units/text imply percent OR value looks like percent (>1.2 and ≤100),
         divide by 100.
       - Otherwise, treat as already a fraction. */
    CASE
      WHEN (r.units ILIKE '%\%%' OR r.units ILIKE '%percent%' OR r.units ILIKE '%pct%')
            AND TRY_TO_DOUBLE(r.value_token) > 1.2
        THEN TRY_TO_DOUBLE(r.value_token) / 100.0
      WHEN TRY_TO_DOUBLE(r.value_token) > 1.2 AND TRY_TO_DOUBLE(r.value_token) <= 100
        THEN TRY_TO_DOUBLE(r.value_token) / 100.0
      ELSE TRY_TO_DOUBLE(r.value_token)
    END AS fev1fvc_ratio,

    /* Promote to POST when a same-day FEV1 POST exists */
    CASE
      WHEN pc.PATIENT_ID IS NOT NULL THEN 'post'
      ELSE
        CASE
          WHEN CONCAT_WS(' ',
                 COALESCE(r.NORMALIZED_DESCRIPTION,''),
                 COALESCE(r.RESULT,'')
               ) ILIKE '%post%bronch%' OR
               CONCAT_WS(' ',
                 COALESCE(r.NORMALIZED_DESCRIPTION,''),
                 COALESCE(r.RESULT,'')
               ) ILIKE '%post-bronchodilator%'
            THEN 'post'
          WHEN CONCAT_WS(' ',
                 COALESCE(r.NORMALIZED_DESCRIPTION,''),
                 COALESCE(r.RESULT,'')
               ) ILIKE '%pre%bronch%'  OR
               CONCAT_WS(' ',
                 COALESCE(r.NORMALIZED_DESCRIPTION,''),
                 COALESCE(r.RESULT,'')
               ) ILIKE '%pre-bronchodilator%'
            THEN 'pre'
          ELSE 'unknown'
        END
    END AS bd_status

  FROM fev1fvc_raw r
  LEFT JOIN post_context pc
    ON pc.PATIENT_ID   = r.PATIENT_ID
   AND pc.ENCOUNTER_ID = r.ENCOUNTER_ID
   AND pc.obs_date     = r.obs_date
),

copd_dx_exclusion AS (
  /* Exclude patients with existing COPD diagnosis */
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'J44%'
),

copd_suspects AS (
  /* Apply the MD "Essential" rule: POST-BD FEV1/FVC > 0.70 */
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    n.units,
    n.fev1fvc_ratio AS value_num,          -- normalized fraction for FHIR
    n.obs_date,
    n.DATA_SOURCE,

    CASE
      WHEN n.bd_status = 'post' AND n.fev1fvc_ratio > 0.70
        THEN 'copd_postbd_ratio_over_0_70'
      ELSE NULL
    END AS suspect_group,

    /* Keep an ICD-10 placeholder for reviewer context (adjust if desired) */
    'J44.9' AS suspect_icd10_code,
    'Chronic obstructive pulmonary disease, unspecified' AS suspect_icd10_short_description

  FROM fev1fvc_norm n
  WHERE n.fev1fvc_ratio > 0              -- plausibility
    AND n.fev1fvc_ratio <= 1.2
    AND NOT EXISTS (SELECT 1 FROM copd_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* Minimal FHIR Observation JSON for the UI */
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
          'unit',  'ratio'
        ),
      /* Preserve original RESULT as string when it's not a plain number */
      'valueString',
        IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    'Observation' AS resource_type,
    s.DATA_SOURCE AS data_source
  FROM copd_suspects s
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  /* Bundle supporting resource(s) for the UI */
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
