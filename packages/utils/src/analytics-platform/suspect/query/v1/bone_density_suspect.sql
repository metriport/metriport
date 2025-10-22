/* ============================================================
   OSTEOPOROSIS / OSTEOPENIA — SUSPECT QUERY (DXA T-score–based)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → DAILY_MIN → SUSPECT → FHIR → RETURN
   Purpose
     Flag bone density suspects using DXA T-scores:
       • Osteoporosis: T-score ≤ −2.5
       • Osteopenia : −2.5 < T-score ≤ −1.0

   Exclusion (diagnosis-based; ICD-10-CM):
     • M80*  (Osteoporosis with current pathological fracture)
     • M81*  (Osteoporosis without current pathological fracture)
     • M85.8* (Other specified disorders of bone density and structure — includes osteopenia)

   Notes
     - Uses CORE_V3.OBSERVATION for DXA results; relies on T-score LOINCs.
     - Picks the worst (most negative) T-score per patient per calendar day.
   ============================================================ */

WITH bone_density_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'M80%'   -- Osteoporosis w/ fracture
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'M81%'   -- Osteoporosis w/o fracture
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'M858%'  -- Osteopenia / other bone density disorders
),

/* -------------------------
   RAW: DXA T-score LOINCs only (unitless)
   ------------------------- */
tscore_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    COALESCE(NULLIF(o.STATUS,''), 'final')          AS status,
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)          AS obs_ts,
    TO_DATE(COALESCE(o.EFFECTIVE_DATE, o.END_DATE)) AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                         AS RESULT,
    o.UNITS,
    o.NOTE_TEXT,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '38267-1',  -- DXA Lumbar spine [T-score] Bone density
    '80948-3',  -- DXA Femur - left [T-score] Bone density
    '80946-7'   -- DXA Hip - left [T-score] Bone density
  )
),

/* -------------------------
   NORM: parse numeric T-score
   ------------------------- */
tscore_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(
      REGEXP_SUBSTR(REPLACE(r.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')
    ) AS tscore_value
  FROM tscore_raw r
),

/* -------------------------
   CLEAN: plausibility checks + diagnosis exclusions
   ------------------------- */
tscore_clean AS (
  SELECT *
  FROM tscore_norm n
  WHERE n.tscore_value IS NOT NULL
    AND n.tscore_value BETWEEN -6.0 AND 6.0
    AND NOT EXISTS (
      SELECT 1 FROM bone_density_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
    )
),

/* -------------------------
   DAILY_MIN: one (worst) T-score per patient per calendar day
   ------------------------- */
tscore_daily_min AS (
  SELECT *
  FROM (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.PATIENT_ID, c.obs_date
        ORDER BY c.tscore_value ASC  -- most negative = worst
      ) AS rn
    FROM tscore_clean c
  )
  WHERE rn = 1
),

/* -------------------------
   SUSPECT: classify by T-score thresholds
   ------------------------- */
osteoporosis_suspects AS (
  SELECT
    d.PATIENT_ID,
    'osteoporosis'                 AS suspect_group,
    'M81'                          AS suspect_icd10_code,
    'Osteoporosis (by DXA T-score ≤ −2.5)' AS suspect_icd10_short_description,

    d.resource_id,
    d.resource_type,
    d.status,
    d.obs_ts       AS obs_date,  -- keep timestamp for FHIR effectiveDateTime
    d.LOINC_CODE,
    d.LOINC_DISPLAY,
    d.RESULT,
    d.UNITS,
    d.tscore_value AS value_num,
    d.DATA_SOURCE
  FROM tscore_daily_min d
  WHERE d.tscore_value <= -2.5
),
osteopenia_suspects AS (
  SELECT
    d.PATIENT_ID,
    'osteopenia'                   AS suspect_group,
    'M85.80'                       AS suspect_icd10_code,
    'Osteopenia (by DXA T-score −1.0 to −2.5)' AS suspect_icd10_short_description,

    d.resource_id,
    d.resource_type,
    d.status,
    d.obs_ts       AS obs_date,
    d.LOINC_CODE,
    d.LOINC_DISPLAY,
    d.RESULT,
    d.UNITS,
    d.tscore_value AS value_num,
    d.DATA_SOURCE
  FROM tscore_daily_min d
  WHERE d.tscore_value > -2.5 AND d.tscore_value <= -1.0
),

all_bd_suspects AS (
  SELECT * FROM osteoporosis_suspects
  UNION ALL
  SELECT * FROM osteopenia_suspects
),

/* -------------------------
   FHIR: minimal Observation per supporting hit
   ------------------------- */
bd_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'final'),
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.LOINC_CODE,
            'display',  NULLIF(s.LOINC_DISPLAY,'')
          )
        )
      ),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  NULL -- T-score is unitless
      ),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM all_bd_suspects s
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
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM bd_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
