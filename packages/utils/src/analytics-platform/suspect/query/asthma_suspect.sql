/* ============================================================
   ASTHMA SUSPECTS via Bronchodilator Reversibility (BDR)
   ------------------------------------------------------
   WHAT THIS DOES
   - Flags "asthma suspects" when spirometry shows reversibility:
       • FEV1 same-day change ≥12% OR ≥200 mL
       • PEF  same-day change ≥20%
     Change can reflect improvement after bronchodilator OR serial change
     on the same calendar date (when explicit post-BD is not present).

   VALUE SET (LOINC)
   - FEV1 (volume, liters):
       • 20150-9  FEV1 (pre/unspecified)
       • 20155-8  FEV1 post-bronchodilation (explicit post-BD)
   - PEF (flow):
       • 33452-4  Peak Expiratory Flow (L/min)

   EXCLUSIONS (dotless ICD-10 compare)
   - Known asthma diagnosis → exclude (REPLACE(code,'.','') LIKE 'J45%')

   OUTPUT
   - One row per patient × suspect_group with the two supporting lab
     results bundled in an array (pre/low and post/high).
   - Minimal FHIR Observation JSON per supporting lab row.
   ============================================================ */

WITH
/* ------------------------------------------------------------
   0) EXCLUDE known asthma diagnoses (dotless ICD-10 logic)
   ------------------------------------------------------------ */
asthma_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'J45%'
),

/* ------------------------------------------------------------
   1) PULL raw FEV1 and PEF rows and parse a numeric token
      - Keep FINAL-like statuses (allow NULL/blank)
      - Restrict to target LOINCs only
   ------------------------------------------------------------ */
raw_spirometry AS (
  SELECT
    lr.PATIENT_ID,
    COALESCE(lr.ENCOUNTER_ID, '')                       AS ENCOUNTER_ID,
    CAST(lr.RESULT_DATE AS DATE)                         AS obs_date,
    lr.LAB_RESULT_ID                                     AS resource_id,
    lr.NORMALIZED_CODE                                   AS loinc,
    lr.NORMALIZED_DESCRIPTION                            AS normalized_description,
    lr.SOURCE_DESCRIPTION,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS, ''), lr.SOURCE_UNITS) AS units_raw,
    lr.RESULT                                            AS result_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('20150-9','20155-8','33452-4')
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND (
      lr.STATUS IS NULL OR TRIM(lr.STATUS) = '' OR
      UPPER(lr.STATUS) IN ('FINAL','CORRECTED','AMENDED','APPENDED','ADDENDED','COMPLETE','COMPLETED','RELEASED')
      OR UPPER(lr.STATUS) LIKE 'FINAL%'
    )
),

/* ------------------------------------------------------------
   2) CLASSIFY metric (FEV1 vs PEF) and infer BD status
      - 20155-8 is always post-BD
      - For others, scan text for "pre"/"post" (bronch/bronchodilator)
   ------------------------------------------------------------ */
classified AS (
  SELECT
    r.*,
    CASE
      WHEN r.loinc IN ('20150-9','20155-8') THEN 'FEV1'
      WHEN r.loinc = '33452-4'              THEN 'PEF'
      ELSE NULL
    END AS metric,

    TRIM(CONCAT_WS(' ',
      COALESCE(r.SOURCE_DESCRIPTION,''),
      COALESCE(r.normalized_description,'')
    )) AS all_text,

    CASE
      WHEN r.loinc = '20155-8' THEN 'post'
      WHEN TRIM(CONCAT_WS(' ',
             COALESCE(r.SOURCE_DESCRIPTION,''),
             COALESCE(r.normalized_description,'')
           )) ILIKE '%post%bronch%' OR
           TRIM(CONCAT_WS(' ',
             COALESCE(r.SOURCE_DESCRIPTION,''),
             COALESCE(r.normalized_description,'')
           )) ILIKE '%post-bronchodilator%'
        THEN 'post'
      WHEN TRIM(CONCAT_WS(' ',
             COALESCE(r.SOURCE_DESCRIPTION,''),
             COALESCE(r.normalized_description,'')
           )) ILIKE '%pre%bronch%' OR
           TRIM(CONCAT_WS(' ',
             COALESCE(r.SOURCE_DESCRIPTION,''),
             COALESCE(r.normalized_description,'')
           )) ILIKE '%pre-bronchodilator%'
        THEN 'pre'
      ELSE 'unknown'
    END AS bd_status
  FROM raw_spirometry r
),

/* ------------------------------------------------------------
   3) NORMALIZE numeric values
      - FEV1  → Liters (L), drop %/predicted/z-score/LLN
      - PEF   → Liters per minute (L/min)
        * If units blank and value looks like L/s (2–15), treat as L/s → *60
        * If units blank and value looks like L/min (50–1000), keep
   ------------------------------------------------------------ */
normalized AS (
  SELECT
    c.PATIENT_ID, c.ENCOUNTER_ID, c.obs_date, c.resource_id,
    c.loinc, c.metric, c.bd_status,
    c.normalized_description, c.result_raw, c.units_raw, c.DATA_SOURCE,

    /* Parsed numeric */
    TRY_TO_DOUBLE(c.value_token) AS value_raw,

    /* Normalized value and canonical display unit by metric */
    CASE
      WHEN c.metric = 'FEV1' THEN
        CASE
          /* Drop % or predicted/z-score/LLN rows */
          WHEN c.units_raw = '%' OR c.all_text ILIKE '%pred%' OR c.all_text ILIKE '%z-score%' OR c.all_text ILIKE '%lln%'
            THEN NULL
          /* Units explicitly mL → convert to L */
          WHEN c.units_raw ILIKE '%ml%' THEN TRY_TO_DOUBLE(c.value_token) / 1000.0
          /* Units explicitly L */
          WHEN c.units_raw ILIKE '%l%'  THEN
            CASE
              /* Guard against mistyped percents in "L": e.g., 79.61, 76 -> NULL */
              WHEN TRY_TO_DOUBLE(c.value_token) BETWEEN 0.2 AND 8.0
                THEN TRY_TO_DOUBLE(c.value_token)
              ELSE NULL
            END
          /* No units: decide by magnitude */
          WHEN TRY_TO_DOUBLE(c.value_token) BETWEEN 200 AND 8000
            THEN TRY_TO_DOUBLE(c.value_token) / 1000.0     -- likely mL (e.g., "2100")
          WHEN TRY_TO_DOUBLE(c.value_token) BETWEEN 0.2 AND 8.0
            THEN TRY_TO_DOUBLE(c.value_token)              -- reasonable liters
          ELSE NULL
        END

      WHEN c.metric = 'PEF' THEN
        CASE
          /* Drop % or predicted/z-score/LLN rows */
          WHEN c.units_raw = '%' OR c.all_text ILIKE '%pred%' OR c.all_text ILIKE '%z-score%' OR c.all_text ILIKE '%lln%'
            THEN NULL
          /* Normalize to L/min */
          WHEN c.units_raw ILIKE '%l/s%'    THEN TRY_TO_DOUBLE(c.value_token) * 60.0
          WHEN c.units_raw ILIKE '%l/min%'  THEN TRY_TO_DOUBLE(c.value_token)
          WHEN c.units_raw ILIKE '%ml/s%'   THEN (TRY_TO_DOUBLE(c.value_token) / 1000.0) * 60.0
          WHEN c.units_raw ILIKE '%ml/min%' THEN  TRY_TO_DOUBLE(c.value_token) / 1000.0
          /* No units: guess by magnitude */
          WHEN TRY_TO_DOUBLE(c.value_token) BETWEEN 2 AND 15
            THEN TRY_TO_DOUBLE(c.value_token) * 60.0       -- likely L/s given blanks like 5.5
          WHEN TRY_TO_DOUBLE(c.value_token) BETWEEN 50 AND 1000
            THEN TRY_TO_DOUBLE(c.value_token)              -- likely L/min (e.g., 300.7)
          ELSE NULL
        END
      ELSE NULL
    END AS value_std,

    CASE
      WHEN c.metric = 'FEV1' THEN 'L'
      WHEN c.metric = 'PEF'  THEN 'L/min'
      ELSE NULL
    END AS value_unit

  FROM classified c
),

/* ------------------------------------------------------------
   4) CLEAN plausible rows and exclude known asthma dx
   ------------------------------------------------------------ */
clean AS (
  SELECT *
  FROM normalized n
  WHERE value_std IS NOT NULL
    AND (
      (n.metric = 'FEV1' AND n.value_std BETWEEN 0.2 AND 8.0) OR
      (n.metric = 'PEF'  AND n.value_std BETWEEN 50  AND 1000)
    )
    AND NOT EXISTS (
      SELECT 1 FROM asthma_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
    )
),

/* ------------------------------------------------------------
   5) SAME-DAY PAIRING (patient + encounter + date + metric)
      - If any explicit POST exists:
          pre/low = lowest among PRE/UNKNOWN; post/high = highest POST
      - Else (no POST that day):
          pre/low = min; post/high = max  (serial change)
   ------------------------------------------------------------ */
grouped AS (
  SELECT
    PATIENT_ID, ENCOUNTER_ID, obs_date, metric,

    /* Max & Min across all same-day values for the metric */
    MAX_BY(resource_id, value_std) AS max_id,  MAX(value_std) AS max_val,
    MIN_BY(resource_id, value_std) AS min_id,  MIN(value_std) AS min_val,

    /* Highest explicit POST (if any) */
    MAX_BY(resource_id, CASE WHEN bd_status='post' THEN value_std ELSE NULL END) AS post_max_id,
    MAX(CASE WHEN bd_status='post' THEN value_std ELSE NULL END)                 AS post_max_val
  FROM clean
  GROUP BY PATIENT_ID, ENCOUNTER_ID, obs_date, metric
),

/* ------------------------------------------------------------
   6) COMPUTE deltas and apply MD thresholds
      - FEV1:  Δ% ≥12 OR ΔmL ≥200
      - PEF:   Δ% ≥20
   ------------------------------------------------------------ */
evaluated AS (
  SELECT
    g.*,
    /* choose the "post/high" and "pre/low" per direction availability */
    CASE WHEN g.post_max_val IS NOT NULL THEN g.post_max_val ELSE g.max_val END AS hi_val,
    CASE WHEN g.post_max_val IS NOT NULL THEN g.min_val     ELSE g.min_val END AS lo_val,
    CASE WHEN g.post_max_id  IS NOT NULL THEN g.post_max_id  ELSE g.max_id END AS hi_id,
    g.min_id AS lo_id,

    /* deltas */
    100.0 * ( (CASE WHEN g.post_max_val IS NOT NULL THEN g.post_max_val ELSE g.max_val END)
              - g.min_val
            ) / NULLIF(g.min_val,0) AS delta_pct,

    /* absolute delta in mL for FEV1 only */
    ( (CASE WHEN g.post_max_val IS NOT NULL THEN g.post_max_val ELSE g.max_val END)
      - g.min_val
    ) * 1000.0 AS delta_ml
  FROM grouped g
),

/* ------------------------------------------------------------
   7) EMIT suspect pairs (one row per metric/day)
   ------------------------------------------------------------ */
bdr_pairs AS (
  /* FEV1 */
  SELECT
    e.PATIENT_ID,
    e.obs_date,
    e.metric,
    IFF(e.post_max_val IS NOT NULL, 'asthma_bdr_postbd', 'asthma_bdr_unknown') AS suspect_group,
    'J45.909'           AS suspect_icd10_code,
    'Asthma, unspecified, uncomplicated' AS suspect_icd10_short_description,
    e.lo_id             AS pre_resource_id,
    e.hi_id             AS post_resource_id
  FROM evaluated e
  WHERE e.metric = 'FEV1'
    AND (e.delta_pct >= 12 OR e.delta_ml >= 200)

  UNION ALL

  /* PEF */
  SELECT
    e.PATIENT_ID,
    e.obs_date,
    e.metric,
    IFF(e.post_max_val IS NOT NULL, 'asthma_bdr_postbd', 'asthma_bdr_unknown') AS suspect_group,
    'J45.909'           AS suspect_icd10_code,
    'Asthma, unspecified, uncomplicated' AS suspect_icd10_short_description,
    e.lo_id             AS pre_resource_id,
    e.hi_id             AS post_resource_id
  FROM evaluated e
  WHERE e.metric = 'PEF'
    AND e.delta_pct >= 20
),

/* ------------------------------------------------------------
   8) FLATTEN to one row per supporting lab result (for FHIR)
   ------------------------------------------------------------ */
pair_rows AS (
  SELECT
    p.PATIENT_ID,
    p.suspect_group,
    p.suspect_icd10_code,
    p.suspect_icd10_short_description,
    p.obs_date,
    'pre'  AS role,
    p.pre_resource_id AS resource_id
  FROM bdr_pairs p
  UNION ALL
  SELECT
    p.PATIENT_ID,
    p.suspect_group,
    p.suspect_icd10_code,
    p.suspect_icd10_short_description,
    p.obs_date,
    'post' AS role,
    p.post_resource_id AS resource_id
  FROM bdr_pairs p
),

/* ------------------------------------------------------------
   9) JOIN back to LAB_RESULT and re-normalize for FHIR display
   ------------------------------------------------------------ */
pair_rows_enriched AS (
  SELECT
    pr.PATIENT_ID,
    pr.suspect_group,
    pr.suspect_icd10_code,
    pr.suspect_icd10_short_description,
    pr.obs_date,
    pr.role,
    lr.LAB_RESULT_ID        AS resource_id,
    lr.NORMALIZED_CODE      AS NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT               AS RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    lr.DATA_SOURCE,

    /* metric */
    CASE
      WHEN lr.NORMALIZED_CODE IN ('20150-9','20155-8') THEN 'FEV1'
      WHEN lr.NORMALIZED_CODE = '33452-4'              THEN 'PEF'
      ELSE NULL
    END AS metric,

    /* parse numeric and normalize for valueQuantity */
    TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) AS value_token_num,

    CASE
      WHEN lr.NORMALIZED_CODE IN ('20150-9','20155-8') THEN
        /* FEV1 → L (guards condensed) */
        CASE
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ml%' THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+'))/1000.0
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%l%'  THEN
            IFF(TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) BETWEEN 0.2 AND 8.0,
                TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')),
                NULL)
          WHEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) BETWEEN 200 AND 8000
            THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+'))/1000.0
          WHEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) BETWEEN 0.2 AND 8.0
            THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+'))
          ELSE NULL
        END
      WHEN lr.NORMALIZED_CODE = '33452-4' THEN
        /* PEF → L/min */
        CASE
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%l/s%'
            THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) * 60.0
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%l/min%'
            THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+'))
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ml/s%'
            THEN (TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) / 1000.0) * 60.0
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ml/min%'
            THEN (TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) / 1000.0)
          WHEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) BETWEEN 2 AND 15
            THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) * 60.0
          WHEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) BETWEEN 50 AND 1000
            THEN TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+'))
          ELSE NULL
        END
      ELSE NULL
    END AS value_num_std,

    CASE
      WHEN lr.NORMALIZED_CODE IN ('20150-9','20155-8') THEN 'L'
      WHEN lr.NORMALIZED_CODE = '33452-4'              THEN 'L/min'
      ELSE NULL
    END AS value_unit_std
  FROM pair_rows pr
  JOIN LAB_RESULT lr
    ON lr.LAB_RESULT_ID = pr.resource_id
),

/* ------------------------------------------------------------
   10) BUILD minimal FHIR Observation JSON per supporting row
   ------------------------------------------------------------ */
obs_with_fhir AS (
  SELECT
    e.PATIENT_ID,
    e.suspect_group,
    e.suspect_icd10_code,
    e.suspect_icd10_short_description,

    e.NORMALIZED_CODE,
    e.NORMALIZED_DESCRIPTION,
    e.RESULT,
    e.units_raw AS units,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            e.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(e.NORMALIZED_DESCRIPTION, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     e.NORMALIZED_CODE,
            'display',  e.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(e.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        OBJECT_CONSTRUCT(
          'value', e.value_num_std,
          'unit',  e.value_unit_std
        )
    ) AS fhir,

    e.resource_id,
    'Observation' AS resource_type,
    e.DATA_SOURCE AS data_source
  FROM pair_rows_enriched e
)

-- ------------------------------------------------------------
-- 11) FINAL RESULT SET
-- ------------------------------------------------------------
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