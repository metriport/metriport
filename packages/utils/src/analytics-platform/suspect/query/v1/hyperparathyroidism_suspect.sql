/* ============================================================
   HYPERPARATHYROIDISM — SUSPECT QUERY (PTH + CALCIUM required)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "hyperparathyroidism" suspects when BOTH are present:
       (1) Elevated PTH (LOINC 2731-8)  > 65 pg/mL
       (2) Elevated calcium (any of):
            • Total Ca (17861-6)        > 10.5 mg/dL
            • Ionized Ca (1995-0)       > 1.32 mmol/L
            • Ionized Ca (12180-6)      > 5.2 mg/dL
     Exclude patients already diagnosed with hyperparathyroidism (ICD-10 E21.*).

   Notes
     - Unit normalization handled in NORM:
       • PTH → pg/mL   (ng/mL ×1000; ng/L ≡ pg/mL)
       • Total Ca → mg/dL (mmol/L ×4.0)
       • Ionized Ca keeps native per-code units (mmol/L for 1995-0; mg/dL for 12180-6)
     - Returns ALL qualifying supporting rows (no “latest” filter).
   ============================================================ */

WITH hyperpara_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'E21%'
),

/* -------------------------
   RAW (OBSERVATION)
   ------------------------- */
pth_raw AS (
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
  WHERE UPPER(o.LOINC_CODE) = '2731-8'   -- Parathyroid hormone [Mass/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
total_ca_raw AS (
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
  WHERE UPPER(o.LOINC_CODE) = '17861-6'  -- Calcium.total [Mass/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
ion_ca_mmol_raw AS (
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
  WHERE UPPER(o.LOINC_CODE) = '1995-0'   -- Calcium.ionized [Moles/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
ion_ca_mgdl_raw AS (
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
  WHERE UPPER(o.LOINC_CODE) = '12180-6'  -- Calcium.ionized [Mass/volume] in Serum or Plasma by ISE
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM (canonical units + numeric)
   ------------------------- */
pth_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)             -- 1 ng/L == 1 pg/mL
      ELSE NULL
    END AS value_num,
    'pg/mL' AS units
  FROM pth_raw r
),
total_ca_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%mmol/l%' THEN TRY_TO_DOUBLE(r.value_token) * 4.0
      ELSE NULL
    END AS value_num,
    'mg/dL' AS units
  FROM total_ca_raw r
),
ion_ca_mmol_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_num,
    'mmol/L' AS units
  FROM ion_ca_mmol_raw r
),
ion_ca_mgdl_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_num,
    'mg/dL' AS units
  FROM ion_ca_mgdl_raw r
),

/* -------------------------
   CLEAN (plausibility + exclude dx)
   ------------------------- */
pth_clean AS (
  SELECT *
  FROM pth_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num > 0
    AND n.value_num <= 5000
    AND NOT EXISTS (SELECT 1 FROM hyperpara_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
total_ca_clean AS (
  SELECT *
  FROM total_ca_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num BETWEEN 6 AND 20
    AND NOT EXISTS (SELECT 1 FROM hyperpara_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
ion_ca_mmol_clean AS (
  SELECT *
  FROM ion_ca_mmol_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num BETWEEN 0.5 AND 2.5
    AND NOT EXISTS (SELECT 1 FROM hyperpara_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
ion_ca_mgdl_clean AS (
  SELECT *
  FROM ion_ca_mgdl_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num BETWEEN 2 AND 8
    AND NOT EXISTS (SELECT 1 FROM hyperpara_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT (per-analyte thresholds)
   ------------------------- */
pth_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM pth_clean c
  WHERE c.value_num > 65
),
total_ca_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM total_ca_clean c
  WHERE c.value_num > 10.5
),
ion_ca_mmol_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM ion_ca_mmol_clean c
  WHERE c.value_num > 1.32
),
ion_ca_mgdl_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM ion_ca_mgdl_clean c
  WHERE c.value_num > 5.2
),

/* Calcium suspects union */
calcium_suspects AS (
  SELECT * FROM total_ca_suspects
  UNION ALL
  SELECT * FROM ion_ca_mmol_suspects
  UNION ALL
  SELECT * FROM ion_ca_mgdl_suspects
),

/* -------------------------
   REQUIRE BOTH: elevated PTH AND elevated Calcium
   ------------------------- */
patients_meeting_essential AS (
  SELECT DISTINCT p.PATIENT_ID
  FROM pth_suspects p
  JOIN calcium_suspects c ON c.PATIENT_ID = p.PATIENT_ID
),

/* -------------------------
   SUPPORTING (all qualifying rows for patients who meet BOTH)
   ------------------------- */
supporting_all AS (
  SELECT
    p.PATIENT_ID,
    'hyperpara_pth_plus_calcium'       AS suspect_group,
    'E21.3'                            AS suspect_icd10_code,
    'Hyperparathyroidism, unspecified' AS suspect_icd10_short_description,
    p.resource_id, p.resource_type,
    /* use LOINC fields in V3 */
    p.LOINC_CODE, p.LOINC_DISPLAY, p.RESULT,
    p.units, p.value_num, p.obs_date, p.DATA_SOURCE
  FROM pth_suspects p
  WHERE p.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)

  UNION ALL

  SELECT
    c.PATIENT_ID,
    'hyperpara_pth_plus_calcium',
    'E21.3',
    'Hyperparathyroidism, unspecified',
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM calcium_suspects c
  WHERE c.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)
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
        'unit',  s.units
      ),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM supporting_all s
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
