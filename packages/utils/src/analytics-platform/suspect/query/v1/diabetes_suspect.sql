/* ============================================================
   DIABETES — SUSPECT QUERY (Glucose & HbA1c) — NEW SCHEMAS
   ------------------------------------------------------------
   Updates applied:
     • Glucose units whitelist tightened to canonical mg/dL|mmol/L only
     • Glucose branch restricted to FASTING only:
         - Always include LOINC 1558-6 (fasting glucose)
         - Allow 2345-7 ONLY when display/result text indicates fasting
   ============================================================ */

WITH dm_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE LEFT(c.ICD_10_CM_CODE, 3) IN ('E08','E09','E10','E11','E13')
),

/* -------------------------
   RAW
   ------------------------- */
/* Fasting Glucose (prefer 1558-6; 2345-7 only if text hints "fast") */
glucose_raw AS (
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
  WHERE
    (
      o.LOINC_CODE = '1558-6'  -- Glucose [Mass/volume] in Serum or Plasma -- fasting
      OR (
        o.LOINC_CODE = '2345-7' -- Generic serum/plasma glucose
        AND (
          UPPER(o.LOINC_DISPLAY) LIKE '%FAST%' OR UPPER(o.VALUE) LIKE '%FAST%'
        )
      )
    )
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

/* HbA1c from OBSERVATION (LOINC 4548-4), ONLY UNITS = '%' */
hba1c_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                            AS RESULT,
    o.UNITS                                                            AS units_raw,  -- must be '%'
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE o.LOINC_CODE = '4548-4'   -- HbA1c
    AND NULLIF(o.UNITS,'') = '%'
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM
   ------------------------- */
/* Glucose → mg/dL (strict unit whitelist) */
glucose_norm AS (
  SELECT
    r.*,
    REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') AS units_key,
    CASE
      WHEN REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') = 'mgdl'
        THEN TRY_TO_DOUBLE(r.value_token)
      WHEN REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') = 'mmoll'
        THEN TRY_TO_DOUBLE(r.value_token) * 18.0182
      ELSE NULL
    END AS value_mg_dl,
    'mg/dL' AS units
  FROM glucose_raw r
),

/* HbA1c → % (no unit conversion; rows are guaranteed UNITS='%') */
hba1c_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_pct,
    '%' AS units
  FROM hba1c_raw r
),

/* -------------------------
   CLEAN
   ------------------------- */
glucose_clean AS (
  SELECT *
  FROM glucose_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl > 0
    AND n.value_mg_dl <= 1000
    AND NOT EXISTS (SELECT 1 FROM dm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

hba1c_clean AS (
  SELECT *
  FROM hba1c_norm n
  WHERE n.value_pct IS NOT NULL
    AND n.value_pct > 0
    AND n.value_pct <= 20
    AND NOT EXISTS (SELECT 1 FROM dm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT
   ------------------------- */
/* Fasting glucose buckets (single-observation screening) */
glucose_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.value_mg_dl >= 200 THEN 'diabetes_glucose_200plus'
      WHEN c.value_mg_dl BETWEEN 126 AND 199 THEN 'diabetes_fpg_126_199'
      ELSE NULL
    END AS suspect_group,
    'E11.9' AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units,
    c.value_mg_dl AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM glucose_clean c
  WHERE c.value_mg_dl >= 126
),

/* HbA1c bucket */
hba1c_suspects AS (
  SELECT
    c.PATIENT_ID,
    'diabetes_hba1c_6p5plus' AS suspect_group,
    'E11.9' AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units,
    c.value_pct AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM hba1c_clean c
  WHERE c.value_pct >= 6.5
),

/* -------------------------
   FHIR
   ------------------------- */
dm_with_fhir AS (
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
        'unit',  s.units
      ),
      'valueString',
        IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM (
    SELECT * FROM glucose_suspects WHERE suspect_group IS NOT NULL
    UNION ALL
    SELECT * FROM hba1c_suspects WHERE suspect_group IS NOT NULL
  ) s
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
FROM dm_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
