/* ============================================================
   ANGINA — SUSPECT QUERY (Troponin-only, sex-specific URLs)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Flag "angina_troponin_elevated" suspects using elevated
     troponin against sex-specific 99th percentile thresholds.

   Data sources (new schemas)
     • OBSERVATION  (LOINC troponins, result + units, dates)
     • CONDITION    (ICD-10 exclusions I20*)
     • PATIENT      (SEX → M/F for URL thresholds)

   Troponin LOINCs and URL cutoffs (ng/L):
     • Troponin I ..................... 10839-9  → M: 26,  F: 16
     • High-sensitivity Troponin I .... 89579-7  → M: 34,  F: 16
     • Troponin T ..................... 6598-7   → M: 15.5 F: 9
     • High-sensitivity Troponin T .... 67151-1  → M: 22,  F: 14

   Unit normalization to ng/L:
     • ng/L → as-is
     • ng/mL → × 1000
     • pg/mL → ≡ ng/L
     • ug/L  → × 1000
   ============================================================ */

WITH angina_dx_exclusion AS (
  /* Exclude patients already diagnosed with angina (ICD-10 I20.*) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'I20%'
),

/* -------------------------
   RAW: pull rows, extract numeric, require units
   ------------------------- */
troponin_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                               AS resource_id,
    'Observation'                                                  AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                        AS RESULT,
    o.UNITS                                                        AS units_raw,
    /* first numeric token (handles "0.034 ng/mL", "40 ng/L", etc.) */
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                      AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE o.LOINC_CODE IN ('10839-9','89579-7','6598-7','67151-1')
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    /* require non-empty units */
    AND NULLIF(o.UNITS,'') IS NOT NULL
    /* numeric token must be > 0 */
    AND TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) > 0
),

/* RAW: patient sex limited to the troponin cohort */
patient_sex_raw AS (
  SELECT
    p.PATIENT_ID,
    CASE
      WHEN p.GENDER ILIKE 'm%' THEN 'M'
      WHEN p.GENDER ILIKE 'f%' THEN 'F'
      ELSE NULL
    END AS sex_code
  FROM CORE_V3.PATIENT p
  WHERE p.PATIENT_ID IN (SELECT DISTINCT PATIENT_ID FROM troponin_raw)
),

/* -------------------------
   NORM: canonicalize value → ng/L and set canonical units
   ------------------------- */
troponin_norm AS (
  SELECT
    r.*,
    /* canonical numeric in ng/L */
    CASE
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)             -- 1 pg/mL == 1 ng/L
      WHEN r.units_raw ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      ELSE NULL
    END AS value_ng_l,
    /* canonical units for downstream use */
    'ng/L' AS units
  FROM troponin_raw r
),

/* -------------------------
   CLEAN: keep plausible values; require known sex; exclude dx
   ------------------------- */
troponin_clean AS (
  SELECT
    n.*,
    sx.sex_code
  FROM troponin_norm n
  INNER JOIN patient_sex_raw sx
          ON sx.PATIENT_ID = n.PATIENT_ID
  WHERE sx.sex_code IN ('M','F')
    AND n.value_ng_l IS NOT NULL
    AND n.value_ng_l > 0
    AND n.value_ng_l <= 20000
    AND NOT EXISTS (SELECT 1 FROM angina_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: apply sex-specific URL thresholds (by LOINC)
   ------------------------- */
troponin_suspects AS (
  SELECT
    c.PATIENT_ID,

    'angina_troponin_elevated' AS suspect_group,
    'I20.9' AS suspect_icd10_code,
    'Angina pectoris, unspecified (screen positive troponin)'
      AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units,                    -- canonical units from NORM
    c.value_ng_l AS value_num,  -- canonical numeric
    c.obs_date,
    c.DATA_SOURCE
  FROM (
    SELECT
      n.*,
      CASE n.LOINC_CODE
        WHEN '10839-9' THEN CASE WHEN n.sex_code = 'M' THEN 26.0 ELSE 16.0 END
        WHEN '89579-7' THEN CASE WHEN n.sex_code = 'M' THEN 34.0 ELSE 16.0 END
        WHEN '6598-7'  THEN CASE WHEN n.sex_code = 'M' THEN 15.5 ELSE 9.0  END
        WHEN '67151-1' THEN CASE WHEN n.sex_code = 'M' THEN 22.0 ELSE 14.0 END
      END AS url_cutoff_ng_l
    FROM troponin_clean n
  ) c
  WHERE c.url_cutoff_ng_l IS NOT NULL
    AND c.value_ng_l > c.url_cutoff_ng_l
),

/* -------------------------
   FHIR: minimal Observation per supporting troponin
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
      'valueQuantity', OBJECT_CONSTRUCT('value', s.value_num, 'unit', s.units),
      /* Preserve original RESULT if needed (e.g., textual) */
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM troponin_suspects s
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
