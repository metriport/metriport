/* ============================================================
   ANOREXIA / BULIMIA — SUSPECT QUERY (BMI ≤ 17)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag eating-disorder (anorexia/bulimia) suspects from:
       (A) Direct BMI (LOINC 39156-5) ≤ 17, and/or
       (B) Derived BMI from same-day Weight (29463-7) + Height (8302-2) ≤ 17.
     Optionally exclude patients already diagnosed with eating disorders.

   Exclusion (diagnosis-based; ICD-10-CM stored WITHOUT dots):
     • F50%  (Eating disorders incl. anorexia nervosa & bulimia nervosa)

   Notes
     - Uses CORE_V3.CORE__OBSERVATION (LOINC) and CORE_V3.CORE__CONDITION (for exclusion).
     - “Same-encounter” pairing approximated as SAME-DAY (patient + date) in v3 schema.
   ============================================================ */

WITH eating_disorder_dx_exclusion AS (
  /* Patients already diagnosed with eating disorder (incl. anorexia, bulimia) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'F50%'  -- dotless ICD-10 category F50.*
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
    o.RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '39156-5'  -- Body mass index (BMI)
  )
  AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
weight_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '29463-7'  -- Body weight
  )
  AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
height_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '8302-2'  -- Body height
  )
  AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM (strict unit handling; no heuristics for unknown units)
   ------------------------- */
bmi_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS bmi_value,
    'kg/m2'                      AS units
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
      WHEN r.units_raw ILIKE '%mm%' THEN TRY_TO_DOUBLE(r.value_token) / 1000.0  -- millimeters -> meters
      WHEN r.units_raw ILIKE '%cm%' THEN TRY_TO_DOUBLE(r.value_token) / 100.0   -- centimeters -> meters
      WHEN r.units_raw ILIKE '%in%' THEN TRY_TO_DOUBLE(r.value_token) * 0.0254  -- inches -> meters
      WHEN r.units_raw ILIKE '%m%'  THEN TRY_TO_DOUBLE(r.value_token)           -- meters
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
    AND n.bmi_value BETWEEN 10 AND 120                 -- plausibility
    AND NOT EXISTS (
      SELECT 1 FROM eating_disorder_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
    )
),
weight_clean AS (
  SELECT *
  FROM weight_norm n
  WHERE n.weight_kg IS NOT NULL
    AND n.weight_kg BETWEEN 20 AND 500                 -- plausibility
),
height_clean AS (
  SELECT *
  FROM height_norm n
  WHERE n.height_m IS NOT NULL
    AND n.height_m BETWEEN 1.0 AND 2.5                 -- plausibility
),

/* Pair same-day weight+height; compute derived BMI */
bmi_derived_clean AS (
  SELECT
    w.PATIENT_ID,
    /* use weight obs id as resource_id for derived BMI */
    w.resource_id,
    'Observation' AS resource_type,
    '39156-5'     AS LOINC_CODE,
    'Body mass index (BMI)' AS LOINC_DISPLAY,
    TO_VARCHAR(w.weight_kg / NULLIF(h.height_m*h.height_m,0)) AS RESULT,
    'kg/m2'       AS units,
    (w.weight_kg / NULLIF(h.height_m*h.height_m,0)) AS bmi_value,
    GREATEST(w.obs_date, h.obs_date) AS obs_date,
    COALESCE(w.DATA_SOURCE, h.DATA_SOURCE) AS DATA_SOURCE
  FROM weight_clean w
  JOIN height_clean h
    ON h.PATIENT_ID = w.PATIENT_ID
   AND h.obs_date   = w.obs_date        -- SAME-DAY pairing for v3 schema
  WHERE (w.weight_kg / NULLIF(h.height_m*h.height_m,0)) IS NOT NULL
    AND (w.weight_kg / NULLIF(h.height_m*h.height_m,0)) BETWEEN 10 AND 120
    AND NOT EXISTS (
      SELECT 1 FROM eating_disorder_dx_exclusion x WHERE x.PATIENT_ID = w.PATIENT_ID
    )
),

/* -------------------------
   SUSPECT
   ------------------------- */
bmi_direct_suspects AS (
  SELECT
    c.PATIENT_ID,
    'anorexia_bulimia' AS suspect_group,
    'F50'              AS suspect_icd10_code,                 -- Category: Eating disorders (anorexia/bulimia)
    'Eating disorder (anorexia/bulimia) — BMI ≤ 17' AS suspect_icd10_short_description,

    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units,
    c.bmi_value AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM bmi_clean c
  WHERE c.bmi_value <= 17
),
bmi_derived_suspects AS (
  SELECT
    d.PATIENT_ID,
    'anorexia_bulimia_derived' AS suspect_group,
    'F50'                      AS suspect_icd10_code,
    'Eating disorder (anorexia/bulimia) — BMI ≤ 17' AS suspect_icd10_short_description,

    d.resource_id,
    d.resource_type,
    d.LOINC_CODE,
    d.LOINC_DISPLAY,
    d.RESULT,
    d.units,
    d.bmi_value AS value_num,
    d.obs_date,
    d.DATA_SOURCE
  FROM bmi_derived_clean d
  WHERE d.bmi_value <= 17
),

all_eating_disorder_suspects AS (
  SELECT * FROM bmi_direct_suspects
  UNION ALL
  SELECT * FROM bmi_derived_suspects
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
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  'kg/m2'
      ),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM all_eating_disorder_suspects s
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
