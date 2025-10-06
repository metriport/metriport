/* ============================================================
   HYPOTHYROIDISM — SUSPECT QUERY (TSH high + T4 low required)
   ------------------------------------------------------------
   Purpose
     Flag "hypothyroidism" suspects when BOTH are present:
       (A) Elevated TSH (LOINC 11580-8, 3016-3, 3015-5)  > 4.5 mIU/L
       (B) Low Thyroxine (T4):
            • Free T4  (3024-7, 6892-4)  < 0.8 ng/dL
            • OR Total T4 (3026-2)       < 5.1 µg/dL
     Exclude patients already diagnosed with hypothyroidism (ICD-10 E03.*).

   Notes
     - Unit normalization:
       • TSH canonical unit: mIU/L
           - mIU/L or µIU/mL (uIU/mL) → value as-is
           - IU/L → value * 1000  (to mIU/L)
       • Free T4 (ng/dL canonical):
           - ng/dL → as-is
           - pmol/L → value / 12.87 (≈ ng/dL)
       • Total T4 (µg/dL canonical):
           - µg/dL / ug/dL / mcg/dL → as-is
           - nmol/L → value / 12.9  (≈ µg/dL)
     - Returns 1 row/patient; bundles supporting Observations in FHIR.

   Output
     • suspect_group: 'hypothyroid_tsh_high_t4_low'
     • ICD-10 (context): E03.9 — Hypothyroidism, unspecified
     • responsible_resources: minimal FHIR Observations for TSH and T4
   ============================================================ */

-- Exclude patients already diagnosed with hypothyroidism
WITH hypo_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'E03.%'
),

/* ------------------------------------------------------------
   TSH (11580-8, 3016-3, 3015-5) — normalize to mIU/L
   ------------------------------------------------------------ */
tsh_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS)                          AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')               AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                                                        AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('11580-8','3016-3','3015-5')  -- TSH
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
tsh_norm AS (
  SELECT
    r.*,
    -- Canonical display unit
    CASE
      WHEN r.units_raw ILIKE '%miu/l%'   THEN 'mIU/L'
      WHEN r.units_raw ILIKE '%uiu/ml%'  OR r.units_raw ILIKE '%µiu/ml%' OR r.units_raw ILIKE '%uIU/mL%' THEN 'mIU/L'
      WHEN r.units_raw ILIKE '%iu/l%'    THEN 'IU/L'
      ELSE r.units_raw
    END AS units_disp,
    -- Convert to mIU/L
    CASE
      WHEN r.units_raw ILIKE '%miu/l%'                         THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%uiu/ml%' OR r.units_raw ILIKE '%µiu/ml%' OR r.units_raw ILIKE '%uIU/mL%' THEN TRY_TO_DOUBLE(r.value_token) -- 1 µIU/mL ≡ 1 mIU/L
      WHEN r.units_raw ILIKE '%iu/l%'                          THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      ELSE NULL
    END AS tsh_miu_l
  FROM tsh_raw r
),
tsh_hits AS (
  -- Keep latest elevated TSH per patient
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.resource_type,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    'mIU/L'              AS units,
    n.tsh_miu_l          AS value_num,
    n.obs_date,
    n.DATA_SOURCE
  FROM tsh_norm n
  WHERE n.tsh_miu_l IS NOT NULL
    AND n.tsh_miu_l > 4.5
    AND NOT EXISTS (SELECT 1 FROM hypo_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY n.PATIENT_ID ORDER BY n.obs_date DESC, n.resource_id DESC) = 1
),

/* ------------------------------------------------------------
   FREE T4 (3024-7, 6892-4) — normalize to ng/dL
   ------------------------------------------------------------ */
ft4_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS)                          AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')               AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                                                        AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('3024-7','6892-4')  -- Free T4
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
ft4_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%ng/dl%'  THEN 'ng/dL'
      WHEN r.units_raw ILIKE '%pmol/l%' THEN 'pmol/L'
      ELSE r.units_raw
    END AS units_disp,
    CASE
      WHEN r.units_raw ILIKE '%ng/dl%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%pmol/l%' THEN TRY_TO_DOUBLE(r.value_token) / 12.87  -- pmol/L → ng/dL
      ELSE NULL
    END AS ft4_ng_dl
  FROM ft4_raw r
),
ft4_low_hits AS (
  -- Keep latest LOW free T4 per patient
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.resource_type,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    'ng/dL'            AS units,
    n.ft4_ng_dl        AS value_num,
    n.obs_date,
    n.DATA_SOURCE,
    'ft4_low'          AS t4_flag
  FROM ft4_norm n
  WHERE n.ft4_ng_dl IS NOT NULL
    AND n.ft4_ng_dl < 0.8
  QUALIFY ROW_NUMBER() OVER (PARTITION BY n.PATIENT_ID ORDER BY n.obs_date DESC, n.resource_id DESC) = 1
),

/* ------------------------------------------------------------
   TOTAL T4 (3026-2) — normalize to µg/dL
   ------------------------------------------------------------ */
tt4_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                      AS resource_id,
    'Observation'                                         AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS)                          AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')               AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                                                        AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '3026-2'  -- Total T4
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
tt4_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%µg/dl%' OR r.units_raw ILIKE '%ug/dl%' OR r.units_raw ILIKE '%mcg/dl%' THEN 'µg/dL'
      WHEN r.units_raw ILIKE '%nmol/l%' THEN 'nmol/L'
      ELSE r.units_raw
    END AS units_disp,
    CASE
      WHEN r.units_raw ILIKE '%µg/dl%' OR r.units_raw ILIKE '%ug/dl%' OR r.units_raw ILIKE '%mcg/dl%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%nmol/l%' THEN TRY_TO_DOUBLE(r.value_token) / 12.9   -- nmol/L → µg/dL
      ELSE NULL
    END AS tt4_ug_dl
  FROM tt4_raw r
),
tt4_low_hits AS (
  -- Keep latest LOW total T4 per patient
  SELECT
    n.PATIENT_ID,
    n.resource_id,
    n.resource_type,
    n.NORMALIZED_CODE,
    n.NORMALIZED_DESCRIPTION,
    n.RESULT,
    'µg/dL'           AS units,
    n.tt4_ug_dl       AS value_num,
    n.obs_date,
    n.DATA_SOURCE,
    'tt4_low'         AS t4_flag
  FROM tt4_norm n
  WHERE n.tt4_ug_dl IS NOT NULL
    AND n.tt4_ug_dl < 5.1
  QUALIFY ROW_NUMBER() OVER (PARTITION BY n.PATIENT_ID ORDER BY n.obs_date DESC, n.resource_id DESC) = 1
),

-- Choose the latest LOW T4 per patient (prefer Free T4 if both present the same day by tie-breaker)
latest_low_t4 AS (
  SELECT *
  FROM (
    SELECT * FROM ft4_low_hits
    UNION ALL
    SELECT * FROM tt4_low_hits
  )
  QUALIFY ROW_NUMBER() OVER (PARTITION BY PATIENT_ID ORDER BY obs_date DESC, resource_id DESC) = 1
),

/* ------------------------------------------------------------
   Patients that meet ESSENTIAL: Elevated TSH AND Low T4
   ------------------------------------------------------------ */
patients_meeting_essential AS (
  SELECT DISTINCT t.PATIENT_ID
  FROM tsh_hits t
  JOIN latest_low_t4 l ON l.PATIENT_ID = t.PATIENT_ID
),

/* ------------------------------------------------------------
   Gather supporting rows (latest elevated TSH + latest low T4)
   ------------------------------------------------------------ */
supporting_all AS (
  SELECT
    t.PATIENT_ID,
    'hypothyroid_tsh_high_t4_low' AS suspect_group,
    'E03.9'                       AS suspect_icd10_code,
    'Hypothyroidism, unspecified' AS suspect_icd10_short_description,

    t.resource_id,
    t.resource_type,
    t.NORMALIZED_CODE,
    t.NORMALIZED_DESCRIPTION,
    t.RESULT,
    t.units,
    t.value_num,
    t.obs_date,
    t.DATA_SOURCE
  FROM tsh_hits t
  WHERE t.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)

  UNION ALL

  SELECT
    l.PATIENT_ID,
    'hypothyroid_tsh_high_t4_low' AS suspect_group,
    'E03.9'                       AS suspect_icd10_code,
    'Hypothyroidism, unspecified' AS suspect_icd10_short_description,

    l.resource_id,
    l.resource_type,
    l.NORMALIZED_CODE,
    l.NORMALIZED_DESCRIPTION,
    l.RESULT,
    l.units,
    l.value_num,
    l.obs_date,
    l.DATA_SOURCE
  FROM latest_low_t4 l
  WHERE l.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_meeting_essential)
),

/* ------------------------------------------------------------
   Build minimal FHIR Observation JSON for each supporting lab
   ------------------------------------------------------------ */
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
      'valueQuantity',
        OBJECT_CONSTRUCT(
          'value', s.value_num,
          'unit',  s.units
        ),
      'valueString',
        IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM supporting_all s
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  /* Enriched responsible resources for the UI */
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,  -- "Observation"
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,

  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
