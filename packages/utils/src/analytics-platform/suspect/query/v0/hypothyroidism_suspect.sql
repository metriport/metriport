/* ============================================================
   HYPOTHYROIDISM — SUSPECT QUERY (TSH high + T4 low required)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "hypothyroidism" suspects when BOTH are present:
       (A) Elevated TSH (11580-8, 3016-3, 3015-5) > 4.5 mIU/L
       (B) Low Thyroxine (T4):
            • Free T4  (3024-7, 6892-4) < 0.8 ng/dL
            • OR Total T4 (3026-2)      < 5.1 µg/dL
     Exclude patients already diagnosed with hypothyroidism (ICD-10 E03.*).

   Notes
     - Unit normalization in NORM:
         • TSH → mIU/L (µIU/mL ≡ mIU/L; IU/L ×1000 → mIU/L)
         • Free T4 → ng/dL (pmol/L ÷ 12.87 → ng/dL)
         • Total T4 → µg/dL (nmol/L ÷ 12.9 → µg/dL)
     - Returns ALL qualifying supporting rows (no “latest” filter).
   ============================================================ */

WITH hypo_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'E03%'
),

/* -------------------------
   RAW
   ------------------------- */
tsh_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                      AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS)            AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                       AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('11580-8','3016-3','3015-5')  -- TSH
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

ft4_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                      AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS)            AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                       AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('3024-7','6892-4')  -- Free T4
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

tt4_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                      AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS)            AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                       AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '3026-2'  -- Total T4
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM (canonical units + numeric)
   ------------------------- */
tsh_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%miu/l%'                                  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%uiu/ml%' OR r.units_raw ILIKE '%µiu/ml%' OR r.units_raw ILIKE '%uiu/mL%' OR r.units_raw ILIKE '%uIU/mL%' THEN TRY_TO_DOUBLE(r.value_token) -- µIU/mL ≡ mIU/L
      WHEN r.units_raw ILIKE '%iu/l%'                                   THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      ELSE NULL
    END AS value_num,
    'mIU/L' AS units
  FROM tsh_raw r
),

ft4_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%ng/dl%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%pmol/l%' THEN TRY_TO_DOUBLE(r.value_token) / 12.87
      ELSE NULL
    END AS value_num,
    'ng/dL' AS units
  FROM ft4_raw r
),

tt4_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%µg/dl%' OR r.units_raw ILIKE '%ug/dl%' OR r.units_raw ILIKE '%mcg/dl%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%nmol/l%' THEN TRY_TO_DOUBLE(r.value_token) / 12.9
      ELSE NULL
    END AS value_num,
    'µg/dL' AS units
  FROM tt4_raw r
),

/* -------------------------
   CLEAN (plausibility + exclude known dx)
   ------------------------- */
tsh_clean AS (
  SELECT *
  FROM tsh_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num BETWEEN 0 AND 1000
    AND NOT EXISTS (SELECT 1 FROM hypo_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

ft4_clean AS (
  SELECT *
  FROM ft4_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num BETWEEN 0 AND 10
    AND NOT EXISTS (SELECT 1 FROM hypo_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

tt4_clean AS (
  SELECT *
  FROM tt4_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num BETWEEN 0 AND 30
    AND NOT EXISTS (SELECT 1 FROM hypo_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT (apply thresholds)
   ------------------------- */
tsh_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.NORMALIZED_CODE, c.NORMALIZED_DESCRIPTION, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM tsh_clean c
  WHERE c.value_num > 4.5
),

ft4_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.NORMALIZED_CODE, c.NORMALIZED_DESCRIPTION, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM ft4_clean c
  WHERE c.value_num < 0.8
),

tt4_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.NORMALIZED_CODE, c.NORMALIZED_DESCRIPTION, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM tt4_clean c
  WHERE c.value_num < 5.1
),

/* Low T4 (either free or total) */
low_t4_suspects AS (
  SELECT * FROM ft4_suspects
  UNION ALL
  SELECT * FROM tt4_suspects
),

/* -------------------------
   REQUIRE BOTH: Elevated TSH AND Low T4
   ------------------------- */
patients_meeting_essential AS (
  SELECT DISTINCT t.PATIENT_ID
  FROM tsh_suspects t
  JOIN low_t4_suspects l ON l.PATIENT_ID = t.PATIENT_ID
),

/* -------------------------
   SUPPORTING: include ALL qualifying TSH + ALL qualifying low T4
   ------------------------- */
supporting_all AS (
  SELECT
    t.PATIENT_ID,
    'hypothyroid_tsh_high_t4_low' AS suspect_group,
    'E03.9'                       AS suspect_icd10_code,
    'Hypothyroidism, unspecified' AS suspect_icd10_short_description,
    t.resource_id, t.resource_type,
    t.NORMALIZED_CODE, t.NORMALIZED_DESCRIPTION, t.RESULT,
    t.units, t.value_num, t.obs_date, t.DATA_SOURCE
  FROM tsh_suspects t
  WHERE t.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)

  UNION ALL

  SELECT
    l.PATIENT_ID,
    'hypothyroid_tsh_high_t4_low' AS suspect_group,
    'E03.9'                       AS suspect_icd10_code,
    'Hypothyroidism, unspecified' AS suspect_icd10_short_description,
    l.resource_id, l.resource_type,
    l.NORMALIZED_CODE, l.NORMALIZED_DESCRIPTION, l.RESULT,
    l.units, l.value_num, l.obs_date, l.DATA_SOURCE
  FROM low_t4_suspects l
  WHERE l.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)
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
