/* ============================================================
   BENIGN CARCINOID — SUSPECT QUERY (24-hr urine 5-HIAA)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag suspects from 24-hour urinary 5-HIAA (LOINC 1695-6)
     when value > 8 mg/24 h, while EXCLUDING patients already
     diagnosed with benign carcinoid (ICD-10 D3A.*).

   Units handled → canonical mg/24 h:
     • mg/24 h (e.g., "mg/24 h", "mg/(24.h)") → as-is
     • mg/day (e.g., "mg/d")                  → as-is
     • Explicitly ignore volume-only units like "mL" (no conversion)

   Note: This threshold is sensitive and may yield false positives.
   ============================================================ */

WITH benign_carcinoid_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'D3A%'
),

/* -------------------------
   RAW: pull 5-HIAA rows (numeric token + units required)
   ------------------------- */
five_hiaa_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                                     AS resource_id,
    'Observation'                                                        AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                                         AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '1695-6'   -- 5-HIAA [Mass/time] in 24h Urine
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) IS NOT NULL
),

/* -------------------------
   NORM: canonicalize to mg/24 h (ignore mL)
   ------------------------- */
five_hiaa_norm AS (
  SELECT
    r.*,
    CASE
      /* direct mg per 24h / day variants */
      WHEN r.units_raw ILIKE '%mg%/24%h%'     THEN TRY_TO_DOUBLE(r.value_token)   -- matches "mg/24 h"
      WHEN r.units_raw ILIKE '%mg/(24.h)%'    THEN TRY_TO_DOUBLE(r.value_token)   -- matches "mg/(24.h)"
      WHEN r.units_raw ILIKE '%mg/d%'         THEN TRY_TO_DOUBLE(r.value_token)   -- matches "mg/d"
      /* explicitly exclude unsupported volume-only units like mL by returning NULL */
      ELSE NULL
    END AS value_mg_24h,
    'mg/24 h' AS units
  FROM five_hiaa_raw r
),

/* -------------------------
   CLEAN: keep plausible values; exclude known D3A.*
   ------------------------- */
five_hiaa_clean AS (
  SELECT *
  FROM five_hiaa_norm n
  WHERE n.value_mg_24h IS NOT NULL         -- drops rows with units like "mL"
    AND n.value_mg_24h > 0
    AND n.value_mg_24h <= 5000             -- wide plausibility guard
    AND NOT EXISTS (
      SELECT 1 FROM benign_carcinoid_dx_exclusion x
      WHERE x.PATIENT_ID = n.PATIENT_ID
    )
),

/* -------------------------
   SUSPECT: threshold > 8 mg/24 h
   ------------------------- */
five_hiaa_suspects AS (
  SELECT
    c.PATIENT_ID,
    'benign_carcinoid_5hiaa_gt8'              AS suspect_group,
    'D3A.8'                                    AS suspect_icd10_code,
    'Benign carcinoid tumor (screen + 5-HIAA)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_mg_24h AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM five_hiaa_clean c
  WHERE c.value_mg_24h > 8
),

/* -------------------------
   FHIR: minimal Observation
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
  FROM five_hiaa_suspects s
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
