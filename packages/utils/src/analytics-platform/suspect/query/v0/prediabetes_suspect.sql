/* ============================================================
   PREDIABETES — SUSPECT QUERY (Glucose & HbA1c)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "prediabetes" suspects from:
       (A) Plasma/Serum Glucose (LOINC 2345-7) normalized to mg/dL
       (B) HbA1c (LOINC 4548-4) using ONLY rows with SOURCE_UNITS='%'
     while EXCLUDING anyone already diagnosed with prediabetes (R73.03).

   Screening buckets (single-observation signals)
     • FPG 100–125 mg/dL        → prediabetes_fpg
     • 2-hr OGTT 140–199 mg/dL  → prediabetes_ogtt
       (If fasting vs. 2-hr isn’t distinguished for 2345-7, both
        ranges are treated as screening signals for review.)
     • HbA1c 5.7–6.4 %          → prediabetes_hba1c
   ============================================================ */

WITH prediabetes_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE = 'R7303'   -- Prediabetes
),

/* -------------------------
   RAW
   ------------------------- */
glucose_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                     AS resource_id,
    'Observation'                                                        AS resource_type,
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.RESULT,
    COALESCE(NULLIF(o.NORMALIZED_UNITS,''), NULLIF(o.SOURCE_UNITS,''))   AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')   AS value_token,
    CAST(o.OBSERVATION_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM core_v2.CORE_V2__OBSERVATION o
  WHERE o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '2345-7'   -- Glucose [Mass/volume] in Serum/Plasma
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(o.NORMALIZED_UNITS,''), NULLIF(o.SOURCE_UNITS,'')) IS NOT NULL
),

hba1c_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                                     AS resource_id,
    'Observation'                                                        AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    lr.SOURCE_UNITS                                                      AS units_raw,  -- SOURCE_UNITS only
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                                         AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '4548-4'   -- HbA1c
    AND lr.SOURCE_UNITS = '%'
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM
   ------------------------- */
glucose_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%mmol/l%' THEN TRY_TO_DOUBLE(r.value_token) * 18.0182
      ELSE NULL
    END AS value_mg_dl,
    'mg/dL' AS units
  FROM glucose_raw r
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
glucose_clean AS (
  SELECT *
  FROM glucose_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl > 0
    AND n.value_mg_dl <= 1000
    AND NOT EXISTS (SELECT 1 FROM prediabetes_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

hba1c_clean AS (
  SELECT *
  FROM hba1c_norm n
  WHERE n.value_pct IS NOT NULL
    AND n.value_pct > 0
    AND n.value_pct <= 20
    AND NOT EXISTS (SELECT 1 FROM prediabetes_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT
   ------------------------- */
glucose_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.value_mg_dl BETWEEN 100 AND 125 THEN 'prediabetes_fpg'
      WHEN c.value_mg_dl BETWEEN 140 AND 199 THEN 'prediabetes_ogtt'
      ELSE NULL
    END AS suspect_group,
    'R73.03' AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_mg_dl AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM glucose_clean c
  WHERE c.value_mg_dl BETWEEN 100 AND 199
),

hba1c_suspects AS (
  SELECT
    c.PATIENT_ID,
    'prediabetes_hba1c' AS suspect_group,
    'R73.03' AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_pct AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM hba1c_clean c
  WHERE c.value_pct BETWEEN 5.7 AND 6.4
),

/* -------------------------
   FHIR
   ------------------------- */
predm_with_fhir AS (
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
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  CASE WHEN s.suspect_group = 'prediabetes_hba1c' THEN '%' ELSE 'mg/dL' END
      ),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
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
FROM predm_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
