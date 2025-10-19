/* ============================================================
   COPD — SUSPECT QUERY (FEV1/FVC Ratio)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Flag COPD suspect from discrete FEV1/FVC ratio:
       • LOINC 19926-5 (FEV1/FVC)
     Exclude anyone already diagnosed with COPD (ICD-10 J44.*).

   Notes
     • Remove post-bronchodilator context and bd_status logic.
     • Input units expected as "%" → normalize to fraction ("ratio").
   ============================================================ */

WITH copd_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c 
  WHERE c.ICD_10_CM_CODE LIKE 'J44%'
),

/* -------------------------
   RAW: candidate FEV1/FVC rows; require numeric token & units
   ------------------------- */
fev1fvc_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                               AS resource_id,
    'Observation'                                                  AS resource_type,
    o.LOINC_CODE                                                   AS LOINC_CODE,
    o.LOINC_DISPLAY                                                AS LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                                        AS units_raw,   -- expected '%'
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE = '19926-5'   -- FEV1/FVC ratio
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS, '') IS NOT NULL
),

/* -------------------------
   NORM: units → 'ratio'; numeric → fraction (units_raw is '%')
   ------------------------- */
fev1fvc_norm AS (
  SELECT
    r.*,
    TRY_TO_NUMBER(r.value_token) / 100.0 AS fev1fvc_ratio,  -- percent → fraction
    'ratio'                              AS units
  FROM fev1fvc_raw r
),

/* -------------------------
   CLEAN: plausibility and exclude COPD dx
   ------------------------- */
fev1fvc_clean AS (
  SELECT n.*
  FROM fev1fvc_norm n
  LEFT JOIN copd_dx_exclusion x ON x.PATIENT_ID = n.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
    AND n.fev1fvc_ratio IS NOT NULL
    AND n.fev1fvc_ratio > 0
    AND n.fev1fvc_ratio <= 1
),

/* -------------------------
   SUSPECT: rule — FEV1/FVC <= 0.70
   ------------------------- */
copd_suspects AS (
  SELECT
    c.PATIENT_ID,
    'copd_postbd_ratio_under_0_70' AS suspect_group,
    'J44.9'                        AS suspect_icd10_code,
    'Chronic obstructive pulmonary disease, unspecified'
                                    AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
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
        'unit',  s.units   -- 'ratio'
      ),
      'valueString', IFF(TRY_TO_NUMBER(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
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
