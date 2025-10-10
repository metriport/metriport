/* ============================================================
   COPD — SUSPECT QUERY (FEV1/FVC Ratio)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Change: remove post_context and bd_status logic; units always "%".
   ============================================================ */

WITH copd_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'J44%'
),

/* -------------------------
   RAW: candidate FEV1/FVC rows; require numeric token & units
   ------------------------- */
fev1fvc_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                       AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) AS units_raw,  -- e.g., '%'
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                       AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '19926-5'     -- FEV1/FVC ratio
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) IS NOT NULL
),

/* -------------------------
   NORM: units → 'ratio'; numeric → fraction (units_raw is '%')
   ------------------------- */
fev1fvc_norm AS (
  SELECT
    r.*,

    /* always percent → fraction */
    TRY_TO_DOUBLE(r.value_token) / 100.0 AS fev1fvc_ratio,
    'ratio' AS units
  FROM fev1fvc_raw r
),

/* -------------------------
   CLEAN: plausibility and exclude COPD dx
   ------------------------- */
fev1fvc_clean AS (
  SELECT *
  FROM fev1fvc_norm n
  WHERE n.fev1fvc_ratio IS NOT NULL
    AND n.fev1fvc_ratio > 0
    AND n.fev1fvc_ratio <= 1
    AND NOT EXISTS (SELECT 1 FROM copd_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: rule — FEV1/FVC <= 0.70
   ------------------------- */
copd_suspects AS (
  SELECT
    c.PATIENT_ID,

    'copd_postbd_ratio_under_0_70' AS suspect_group,
    'J44.9'                       AS suspect_icd10_code,
    'Chronic obstructive pulmonary disease, unspecified'
                                   AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.fev1fvc_ratio AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM fev1fvc_clean c
  WHERE c.fev1fvc_ratio <= 0.70
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
        'unit',  s.units
      ),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM copd_suspects s
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
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
