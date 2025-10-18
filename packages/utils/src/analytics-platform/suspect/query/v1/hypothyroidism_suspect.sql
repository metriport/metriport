/* ============================================================
   HYPOTHYROIDISM — SUSPECT QUERY (TSH high + T4 low OR Levothyroxine)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "hypothyroidism" suspects when ANY path is present:
       LABS PATH (both required):
         (A) Elevated TSH (LOINC 11580-8, 3016-3, 3015-5) > 4.5 mIU/L
         (B) Low Thyroxine (T4):
              • Free T4  (LOINC 3024-7, 6892-4) < 0.8 ng/dL
              • OR Total T4 (LOINC 3026-2)      < 5.1 µg/dL
       MEDS PATH:
         (C) Treatment with Levothyroxine via MedicationRequest only
     Exclude patients already diagnosed with hypothyroidism (ICD-10 E03.*).

   Notes
     - Unit normalization in NORM:
         • TSH → mIU/L (µIU/mL ≡ mIU/L; IU/L ×1000 → mIU/L)
         • Free T4 → ng/dL (pmol/L ÷ 12.87 → ng/dL)
         • Total T4 → µg/dL (nmol/L ÷ 12.9 → µg/dL)
     - Returns ALL qualifying supporting rows (no “latest” filter).
     - Medication matching uses RXNORM/NDC display strings:
         LEVOTHYROXINE (generic) and common brands (SYNTHROID, LEVOXYL, TIROSINT, UNITHROID).
   ============================================================ */

WITH hypo_dx_exclusion AS (
  /* Exclude known hypothyroidism: ICD-10 E03.* */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'E03%'
),

/* -------------------------
   RAW (OBSERVATION) — labs
   ------------------------- */
tsh_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS          AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '11580-8',  -- TSH [Units/volume] in Serum or Plasma
    '3016-3',   -- TSH [Units/volume] in Serum or Plasma
    '3015-5'    -- TSH [Units/volume] in Serum or Plasma
  )
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
ft4_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS          AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '3024-7',  -- Thyroxine (T4) free [Mass/volume] in Serum or Plasma
    '6892-4'   -- Thyroxine (T4) free [Moles/volume] in Serum or Plasma
  )
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
tt4_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS          AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) = '3026-2'  -- Thyroxine (T4) [Mass/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM (canonical units + numeric)
   ------------------------- */
tsh_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%miu/l%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%uiu/ml%' OR r.units_raw ILIKE '%µiu/ml%' OR r.units_raw ILIKE '%uIU/mL%' THEN TRY_TO_DOUBLE(r.value_token)  -- µIU/mL ≡ mIU/L
      WHEN r.units_raw ILIKE '%iu/l%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
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
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM tsh_clean c
  WHERE c.value_num > 4.5
),
ft4_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM ft4_clean c
  WHERE c.value_num < 0.8
),
tt4_suspects AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id, c.resource_type,
    c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT,
    c.units, c.value_num, c.obs_date, c.DATA_SOURCE
  FROM tt4_clean c
  WHERE c.value_num < 5.1
),
low_t4_suspects AS (
  SELECT * FROM ft4_suspects
  UNION ALL
  SELECT * FROM tt4_suspects
),

/* -------------------------
   LABS PATH: REQUIRE BOTH (Elevated TSH AND Low T4)
   ------------------------- */
patients_by_labs AS (
  SELECT DISTINCT t.PATIENT_ID
  FROM tsh_suspects t
  JOIN low_t4_suspects l ON l.PATIENT_ID = t.PATIENT_ID
),

/* ============================================================
   MEDS PATH — LEVOTHYROXINE (MedicationRequest ONLY)
   ============================================================ */
levothyroxine_catalog AS (
  /* Identify levothyroxine products by RxNorm/NDC display (generic + brands) */
  SELECT DISTINCT
    m.MEDICATION_ID,
    m.RXNORM_CODE,
    m.RXNORM_DISPLAY,
    m.NDC_CODE,
    m.NDC_DISPLAY,
    m.DATA_SOURCE
  FROM CORE_V3.CORE__MEDICATION m
  WHERE
    (UPPER(COALESCE(m.RXNORM_DISPLAY,'')) LIKE '%LEVOTHYROX%'  -- levothyroxine (generic)
      OR UPPER(COALESCE(m.NDC_DISPLAY,'')) LIKE '%LEVOTHYROX%'
      OR UPPER(COALESCE(m.RXNORM_DISPLAY,'')) LIKE '%SYNTHROID%'  -- brand
      OR UPPER(COALESCE(m.NDC_DISPLAY,'')) LIKE '%SYNTHROID%'
      OR UPPER(COALESCE(m.RXNORM_DISPLAY,'')) LIKE '%LEVOXYL%'    -- brand
      OR UPPER(COALESCE(m.NDC_DISPLAY,'')) LIKE '%LEVOXYL%'
      OR UPPER(COALESCE(m.RXNORM_DISPLAY,'')) LIKE '%TIROSINT%'   -- brand
      OR UPPER(COALESCE(m.NDC_DISPLAY,'')) LIKE '%TIROSINT%'
      OR UPPER(COALESCE(m.RXNORM_DISPLAY,'')) LIKE '%UNITHROID%'  -- brand
      OR UPPER(COALESCE(m.NDC_DISPLAY,'')) LIKE '%UNITHROID%')
),

/* MedicationRequest for Levothyroxine */
levothyroxine_request_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID AS resource_id,
    'MedicationRequest'      AS resource_type,
    lc.RXNORM_CODE,
    lc.RXNORM_DISPLAY,
    lc.NDC_CODE,
    lc.NDC_DISPLAY,
    mr.AUTHORED_ON           AS obs_date,
    mr.DATA_SOURCE
  FROM CORE__MEDICATION_REQUEST mr
  JOIN levothyroxine_catalog lc
    ON lc.MEDICATION_ID = mr.MEDICATION_ID
  WHERE NOT EXISTS (SELECT 1 FROM hypo_dx_exclusion x WHERE x.PATIENT_ID = mr.PATIENT_ID)
),

/* -------------------------
   SUPPORTING ROWS (UNION with aligned columns)
   19 columns, consistent across branches
   ------------------------- */
supporting_labs AS (
  /* TSH rows for lab-based patients */
  SELECT
    t.PATIENT_ID,
    'hypothyroid_tsh_high_t4_low' AS suspect_group,
    'E03.9'                       AS suspect_icd10_code,
    'Hypothyroidism, unspecified' AS suspect_icd10_short_description,
    t.resource_id,
    t.resource_type,
    /* LOINC fields (labs) */
    t.LOINC_CODE,
    t.LOINC_DISPLAY,
    t.RESULT,
    t.units,
    t.value_num,
    t.obs_date,
    t.DATA_SOURCE,
    /* Med placeholders */
    CAST(NULL AS VARCHAR) AS RXNORM_CODE,
    CAST(NULL AS VARCHAR) AS RXNORM_DISPLAY,
    CAST(NULL AS VARCHAR) AS NDC_CODE,
    CAST(NULL AS VARCHAR) AS NDC_DISPLAY,
    CAST(NULL AS DATE)    AS START_DATE,
    CAST(NULL AS DATE)    AS END_DATE
  FROM tsh_suspects t
  WHERE t.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_by_labs)

  UNION ALL

  /* Low T4 rows for lab-based patients */
  SELECT
    l.PATIENT_ID,
    'hypothyroid_tsh_high_t4_low',
    'E03.9',
    'Hypothyroidism, unspecified',
    l.resource_id,
    l.resource_type,
    l.LOINC_CODE,
    l.LOINC_DISPLAY,
    l.RESULT,
    l.units,
    l.value_num,
    l.obs_date,
    l.DATA_SOURCE,
    CAST(NULL AS VARCHAR) AS RXNORM_CODE,
    CAST(NULL AS VARCHAR) AS RXNORM_DISPLAY,
    CAST(NULL AS VARCHAR) AS NDC_CODE,
    CAST(NULL AS VARCHAR) AS NDC_DISPLAY,
    CAST(NULL AS DATE)    AS START_DATE,
    CAST(NULL AS DATE)    AS END_DATE
  FROM low_t4_suspects l
  WHERE l.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_by_labs)
),

supporting_meds AS (
  /* MedicationRequest rows (Levothyroxine) */
  SELECT
    r.PATIENT_ID,
    'hypothyroid_levothyroxine_treatment' AS suspect_group,
    'E03.9'                                AS suspect_icd10_code,
    'Hypothyroidism, unspecified'          AS suspect_icd10_short_description,
    r.resource_id,
    r.resource_type,
    /* LOINC placeholders */
    CAST(NULL AS VARCHAR) AS LOINC_CODE,
    CAST(NULL AS VARCHAR) AS LOINC_DISPLAY,
    CAST(NULL AS VARCHAR) AS RESULT,
    CAST(NULL AS VARCHAR) AS units,
    CAST(NULL AS DOUBLE)  AS value_num,
    r.obs_date,
    r.DATA_SOURCE,
    /* Med coding */
    r.RXNORM_CODE,
    r.RXNORM_DISPLAY,
    r.NDC_CODE,
    r.NDC_DISPLAY,
    CAST(NULL AS DATE) AS START_DATE,
    CAST(NULL AS DATE) AS END_DATE
  FROM levothyroxine_request_raw r
),

supporting_all AS (
  SELECT * FROM supporting_labs
  UNION ALL
  SELECT * FROM supporting_meds
),

/* -------------------------
   FHIR BUILDERS
   ------------------------- */
/* Observations (TSH, T4) */
with_fhir_observation AS (
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,
    f.resource_id,
    'Observation' AS resource_type,
    f.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','Observation',
      'id',            f.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(f.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',f.LOINC_CODE,'display',NULLIF(f.LOINC_DISPLAY,''))
        )
      ),
      'effectiveDateTime', IFF(f.obs_date IS NOT NULL, TO_CHAR(f.obs_date,'YYYY-MM-DD'), NULL),
      'valueQuantity', IFF(f.value_num IS NOT NULL, OBJECT_CONSTRUCT('value', f.value_num, 'unit', f.units), NULL),
      'valueString',  NULL
    ) AS fhir
  FROM supporting_all f
  WHERE f.resource_type = 'Observation'
),

/* MedicationRequest (Levothyroxine) */
with_fhir_medrequest AS (
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,
    f.resource_id,
    'MedicationRequest' AS resource_type,
    f.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','MedicationRequest',
      'id',            f.resource_id,
      'status',        'active',
      'intent',        'order',
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'text', COALESCE(NULLIF(f.RXNORM_DISPLAY,''), NULLIF(f.NDC_DISPLAY,'')),
        'coding', ARRAY_CONSTRUCT_COMPACT(
          IFF(f.RXNORM_CODE IS NOT NULL AND f.RXNORM_CODE <> '',
              OBJECT_CONSTRUCT('system','http://www.nlm.nih.gov/research/umls/rxnorm','code',f.RXNORM_CODE,'display',NULLIF(f.RXNORM_DISPLAY,'')),
              NULL),
          IFF(f.NDC_CODE IS NOT NULL AND f.NDC_CODE <> '',
              OBJECT_CONSTRUCT('system','http://hl7.org/fhir/sid/ndc','code',f.NDC_CODE,'display',NULLIF(f.NDC_DISPLAY,'')),
              NULL)
        )
      ),
      'authoredOn', IFF(f.obs_date IS NOT NULL, TO_CHAR(f.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM supporting_all f
  WHERE f.resource_type = 'MedicationRequest'
),

with_fhir_all AS (
  SELECT * FROM with_fhir_observation
  UNION ALL
  SELECT * FROM with_fhir_medrequest
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
FROM with_fhir_all
WHERE NULLIF(DATA_SOURCE, '') IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
