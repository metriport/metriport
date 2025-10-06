/* ============================================================
   ANGINA — SUSPECT QUERY (Troponin-only, sex-specific URLs)
   ------------------------------------------------------------
   Purpose
     Flag "angina_troponin_elevated" suspects using **elevated troponin**
     (sex-specific 99th percentile thresholds) from LAB_RESULT.

   Signals (LOINC; normalized to ng/L)
     • 10839-9  Troponin I (cTnI):            URL → Male 26, Female 16 ng/L
     • 89579-7  High-sensitivity Troponin I:  URL → Male 34, Female 16 ng/L
     • 6598-7   Troponin T (cTnT):            URL → Male 15.5, Female 9 ng/L
     • 67151-1  High-sensitivity Troponin T:  URL → Male 22, Female 14 ng/L

   Units handled → canonical ng/L
     • ng/L    → value as-is
     • ng/mL   → value * 1000
     • pg/mL   → value       (1 pg/mL == 1 ng/L)
     • ug/L    → value * 1000
     • Empty/other units are ignored.

   Exclusions
     • Patients already diagnosed with Angina: ICD-10 I20.*

   Output
     • One row per patient × suspect_group (angina_troponin_elevated)
     • Responsible resources: minimal FHIR Observation (one per qualifying troponin)
   ============================================================ */

WITH angina_dx_exclusion AS (
  -- Exclude patients already diagnosed with Angina (I20.*)
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I20.%'
),

troponin_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID AS resource_id,
    'Observation' AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(lr.RESULT_DATE AS DATE) AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('10839-9','89579-7','6598-7','67151-1')
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) IS NOT NULL
),

troponin_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%ng/l%'  THEN 'ng/L'
      WHEN r.units_raw ILIKE '%ng/ml%' THEN 'ng/mL'
      WHEN r.units_raw ILIKE '%pg/ml%' THEN 'pg/mL'
      WHEN r.units_raw ILIKE '%ug/l%'  THEN 'ug/L'
      ELSE r.units_raw
    END AS units_disp,
    CASE
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)      -- 1 pg/mL == 1 ng/L
      WHEN r.units_raw ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      ELSE NULL
    END AS value_ng_l
  FROM troponin_raw r
),

patient_sex AS (
  SELECT
    p.PATIENT_ID,
    CASE
      WHEN p.SEX ILIKE 'm%' THEN 'M'
      WHEN p.SEX ILIKE 'f%' THEN 'F'
      ELSE 'U'
    END AS sex_code
  FROM PATIENT p
),

troponin_hits AS (
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.resource_type,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    'ng/L' AS units,
    n.value_ng_l AS value_num,
    n.obs_date,
    n.DATA_SOURCE,
    CASE n.NORMALIZED_CODE
      WHEN '10839-9' THEN CASE WHEN sx.sex_code = 'M' THEN 26.0 ELSE 16.0 END
      WHEN '89579-7' THEN CASE WHEN sx.sex_code = 'M' THEN 34.0 ELSE 16.0 END
      WHEN '6598-7'  THEN CASE WHEN sx.sex_code = 'M' THEN 15.5 ELSE 9.0 END
      WHEN '67151-1' THEN CASE WHEN sx.sex_code = 'M' THEN 22.0 ELSE 14.0 END
    END AS url_cutoff_ng_l
  FROM troponin_norm n
  LEFT JOIN patient_sex sx ON sx.PATIENT_ID = n.PATIENT_ID
  WHERE n.value_ng_l IS NOT NULL
    AND n.value_ng_l > 0
    AND n.value_ng_l <= 100000
    AND NOT EXISTS (SELECT 1 FROM angina_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

troponin_above_url AS (
  SELECT
    h.*,
    'angina_troponin_elevated' AS suspect_group,
    'I20.9' AS suspect_icd10_code,
    'Angina pectoris, unspecified (screen positive troponin)' AS suspect_icd10_short_description
  FROM troponin_hits h
  WHERE h.value_num > h.url_cutoff_ng_l
),

obs_with_fhir AS (
  SELECT
    t.PATIENT_ID,
    t.suspect_group,
    t.suspect_icd10_code,
    t.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            t.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(t.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     t.NORMALIZED_CODE,
            'display',  t.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(t.obs_date, 'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', t.value_num,
        'unit',  'ng/L'
      ),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(t.RESULT,'%','')) IS NULL, t.RESULT, NULL)
    ) AS fhir,
    t.resource_id,
    t.resource_type,
    t.DATA_SOURCE AS data_source
  FROM troponin_above_url t
)

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
