/* ============================================================
   ANOREXIA / BULIMIA — SUSPECT QUERY (BMI ≤ 17)
   (2-decimal rounding + one-per-day collapse, direct > derived)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → DEDUPE → FHIR → RETURN
   ============================================================ */

WITH eating_disorder_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'F50%'
),

/* -------------------------
   RAW
   ------------------------- */
bmi_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                         AS RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN ('39156-5')  -- BMI
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
weight_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                         AS RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN ('29463-7')  -- Weight
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
height_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                         AS RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN ('8302-2')  -- Height
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM (round to 2 decimals)
   ------------------------- */
bmi_norm AS (
  SELECT
    r.*,
    ROUND(TRY_TO_DOUBLE(r.value_token), 2) AS bmi_value,
    'kg/m2'                                AS units
  FROM bmi_raw r
),
weight_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%kg%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%lb%' THEN TRY_TO_DOUBLE(r.value_token) * 0.45359237
      WHEN r.units_raw ILIKE '%oz%' THEN TRY_TO_DOUBLE(r.value_token) * 0.028349523125
      ELSE NULL
    END AS weight_kg
  FROM weight_raw r
),
height_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%mm%' THEN TRY_TO_DOUBLE(r.value_token) / 1000.0
      WHEN r.units_raw ILIKE '%cm%' THEN TRY_TO_DOUBLE(r.value_token) / 100.0
      WHEN r.units_raw ILIKE '%in%' THEN TRY_TO_DOUBLE(r.value_token) * 0.0254
      WHEN r.units_raw ILIKE '%m%'  THEN TRY_TO_DOUBLE(r.value_token)
      ELSE NULL
    END AS height_m
  FROM height_raw r
),

/* -------------------------
   CLEAN
   ------------------------- */
bmi_clean AS (
  SELECT *
  FROM bmi_norm n
  WHERE n.bmi_value IS NOT NULL
    AND n.bmi_value BETWEEN 10 AND 120
    AND NOT EXISTS (SELECT 1 FROM eating_disorder_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
weight_clean AS (
  SELECT *
  FROM weight_norm n
  WHERE n.weight_kg IS NOT NULL
    AND n.weight_kg BETWEEN 20 AND 500
),
height_clean AS (
  SELECT *
  FROM height_norm n
  WHERE n.height_m IS NOT NULL
    AND n.height_m BETWEEN 1.0 AND 2.5
),

/* Same-day pairing; compute BMI rounded to 2 decimals */
bmi_derived_clean AS (
  SELECT
    w.PATIENT_ID,
    w.resource_id,
    'Observation' AS resource_type,
    '39156-5'     AS LOINC_CODE,
    'Body mass index (BMI)' AS LOINC_DISPLAY,
    TO_VARCHAR(ROUND(w.weight_kg / NULLIF(h.height_m*h.height_m,0), 2)) AS RESULT,
    'kg/m2'       AS units,
    ROUND(w.weight_kg / NULLIF(h.height_m*h.height_m,0), 2) AS bmi_value,
    GREATEST(w.obs_date, h.obs_date) AS obs_date,
    COALESCE(w.DATA_SOURCE, h.DATA_SOURCE) AS DATA_SOURCE
  FROM weight_clean w
  JOIN height_clean h
    ON h.PATIENT_ID = w.PATIENT_ID
   AND h.obs_date   = w.obs_date
  WHERE (w.weight_kg / NULLIF(h.height_m*h.height_m,0)) IS NOT NULL
    AND (w.weight_kg / NULLIF(h.height_m*h.height_m,0)) BETWEEN 10 AND 120
    AND NOT EXISTS (SELECT 1 FROM eating_disorder_dx_exclusion x WHERE x.PATIENT_ID = w.PATIENT_ID)
),

/* -------------------------
   SUSPECT (BMI ≤ 17), per-path daily collapse
   ------------------------- */
bmi_direct_suspects AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (PARTITION BY c.PATIENT_ID, c.obs_date ORDER BY c.resource_id DESC) AS rn_direct
  FROM bmi_clean c
  WHERE c.bmi_value <= 17
),
bmi_derived_suspects AS (
  SELECT
    d.*,
    ROW_NUMBER() OVER (PARTITION BY d.PATIENT_ID, d.obs_date ORDER BY d.resource_id DESC) AS rn_derived
  FROM bmi_derived_clean d
  WHERE d.bmi_value <= 17
),

/* Keep 1 per patient/day per path */
bmi_direct_daily AS (
  SELECT * FROM bmi_direct_suspects WHERE rn_direct = 1
),
bmi_derived_daily AS (
  SELECT * FROM bmi_derived_suspects WHERE rn_derived = 1
),

/* -------------------------
   Cross-path daily collapse (prefer direct BMI over derived)
   ------------------------- */
all_candidates AS (
  SELECT
    PATIENT_ID, resource_id, resource_type, LOINC_CODE, LOINC_DISPLAY,
    RESULT, units, bmi_value AS value_num, obs_date, DATA_SOURCE,
    1 AS path_preference
  FROM bmi_direct_daily
  UNION ALL
  SELECT
    PATIENT_ID, resource_id, resource_type, LOINC_CODE, LOINC_DISPLAY,
    RESULT, units, bmi_value AS value_num, obs_date, DATA_SOURCE,
    2 AS path_preference
  FROM bmi_derived_daily
),
daily_choice AS (
  SELECT *
  FROM (
    SELECT
      a.*,
      ROW_NUMBER() OVER (PARTITION BY a.PATIENT_ID, a.obs_date ORDER BY a.path_preference ASC, a.resource_id DESC) AS rn
    FROM all_candidates a
  )
  WHERE rn = 1
),

/* -------------------------
   AGE FILTER: include only 18–45 at obs_date
   ------------------------- */
daily_choice_age_filtered AS (
  SELECT d.*
  FROM daily_choice d
  JOIN CORE_V3.PATIENT p
    ON p.PATIENT_ID = d.PATIENT_ID
  WHERE p.BIRTH_DATE IS NOT NULL
    AND FLOOR(DATEDIFF('day', p.BIRTH_DATE, d.obs_date) / 365.2425) BETWEEN 18 AND 45
),

/* -------------------------
   FHIR
   ------------------------- */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    'bmi_lte_17' AS suspect_group,
    'F50'        AS suspect_icd10_code,
    'Eating disorder (anorexia/bulimia) — BMI ≤ 17' AS suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',s.LOINC_CODE,'display',s.LOINC_DISPLAY)
        )
      ),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', ROUND(s.value_num, 2),
        'unit',  'kg/m2'
      ),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM daily_choice_age_filtered s
)

/* -------------------------
   RETURN
   ------------------------- */
SELECT
  PATIENT_ID,
  'bmi_lte_17' AS suspect_group,
  'F50'        AS suspect_icd10_code,
  'Eating disorder (anorexia/bulimia) — BMI ≤ 17' AS suspect_icd10_short_description,
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
GROUP BY PATIENT_ID
ORDER BY PATIENT_ID;
