/* ============================================================
   PREDIABETES — SUSPECT QUERY (Glucose & HbA1c) — NEW SCHEMAS
   ------------------------------------------------------------
   Aligns unit/fasting handling with DIABETES v3:
     • Glucose units whitelist: mg/dL or mmol/L only (strict units_key)
     • Glucose gating:
         - FASTING: always include 1558-6; allow 2345-7 only if text hints "FAST"
         - 2-hr OGTT: allow 2345-7 only if text hints "2H/2 HR/120 MIN/OGTT"
   ============================================================ */

WITH prediabetes_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE = 'R7303'   -- Prediabetes
  OR LEFT(c.ICD_10_CM_CODE, 3) IN ('E08','E09','E10','E11','E13')
),

/* -------------------------
   RAW
   ------------------------- */
/* Fasting glucose (prefer 1558-6; 2345-7 only if text hints FAST) */
glucose_fast_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                                            AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                         AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE
    (
      o.LOINC_CODE = '1558-6'  -- fasting glucose
      OR (
        o.LOINC_CODE = '2345-7'  -- generic serum/plasma glucose
        AND (
          UPPER(o.LOINC_DISPLAY) LIKE '%FAST%' OR UPPER(o.RESULT) LIKE '%FAST%'
        )
      )
    )
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

/* 2-hr OGTT signal when sites use 2345-7 but label it in text */
glucose_ogtt_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                                            AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                         AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE
    o.LOINC_CODE = '2345-7'  -- sites often reuse this for OGTT with text hints
    AND (
      UPPER(o.LOINC_DISPLAY) LIKE '%2H%' OR UPPER(o.RESULT) LIKE '%2H%'
      OR UPPER(o.LOINC_DISPLAY) LIKE '%2-HR%' OR UPPER(o.RESULT) LIKE '%2-HR%'
      OR UPPER(o.LOINC_DISPLAY) LIKE '%2 HR%' OR UPPER(o.RESULT) LIKE '%2 HR%'
      OR UPPER(o.LOINC_DISPLAY) LIKE '%120 MIN%' OR UPPER(o.RESULT) LIKE '%120 MIN%'
      OR UPPER(o.LOINC_DISPLAY) LIKE '%OGTT%' OR UPPER(o.RESULT) LIKE '%OGTT%'
    )
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

/* HbA1c from OBSERVATION (units must be '%') */
hba1c_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                                            AS units_raw,  -- must be '%'
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                         AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE = '4548-4'
    AND NULLIF(o.UNITS,'') = '%'
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM (strict unit whitelist)
   ------------------------- */
glucose_fast_norm AS (
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
  FROM glucose_fast_raw r
),

glucose_ogtt_norm AS (
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
  FROM glucose_ogtt_raw r
),

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
glucose_fast_clean AS (
  SELECT *
  FROM glucose_fast_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl > 0 AND n.value_mg_dl <= 1000
    AND NOT EXISTS (SELECT 1 FROM prediabetes_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

glucose_ogtt_clean AS (
  SELECT *
  FROM glucose_ogtt_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl > 0 AND n.value_mg_dl <= 1000
    AND NOT EXISTS (SELECT 1 FROM prediabetes_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

hba1c_clean AS (
  SELECT *
  FROM hba1c_norm n
  WHERE n.value_pct IS NOT NULL
    AND n.value_pct > 0 AND n.value_pct <= 20
    AND NOT EXISTS (SELECT 1 FROM prediabetes_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT
   ------------------------- */
glucose_fast_suspects AS (
  SELECT
    c.PATIENT_ID,
    'prediabetes_fpg' AS suspect_group,
    'R73.03' AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_mg_dl AS value_num, c.obs_date, c.DATA_SOURCE
  FROM glucose_fast_clean c
  WHERE c.value_mg_dl BETWEEN 100 AND 125
),

glucose_ogtt_suspects AS (
  SELECT
    c.PATIENT_ID,
    'prediabetes_ogtt' AS suspect_group,
    'R73.03' AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_mg_dl AS value_num, c.obs_date, c.DATA_SOURCE
  FROM glucose_ogtt_clean c
  WHERE c.value_mg_dl BETWEEN 140 AND 199
),

hba1c_suspects AS (
  SELECT
    c.PATIENT_ID,
    'prediabetes_hba1c' AS suspect_group,
    'R73.03' AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_pct AS value_num, c.obs_date, c.DATA_SOURCE
  FROM hba1c_clean c
  WHERE c.value_pct BETWEEN 5.7 AND 6.4
),

/* -------------------------
   FHIR
   ------------------------- */
predm_with_fhir AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
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
      'effectiveDateTime', TO_CHAR(s.obs_date,'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  CASE WHEN s.suspect_group = 'prediabetes_hba1c' THEN '%' ELSE 'mg/dL' END
      ),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id, s.resource_type, s.DATA_SOURCE AS data_source
  FROM (
    SELECT * FROM glucose_fast_suspects
    UNION ALL
    SELECT * FROM glucose_ogtt_suspects
    UNION ALL
    SELECT * FROM hba1c_suspects
  ) s
)

/* -------------------------
   RETURN
   ------------------------- */
SELECT
  PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description,
  ARRAY_AGG(OBJECT_CONSTRUCT(
    'id',resource_id,'resource_type',resource_type,'data_source',data_source,'fhir',fhir
  )) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM predm_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
