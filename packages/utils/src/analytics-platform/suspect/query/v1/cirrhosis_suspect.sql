/* ============================================================
   CIRRHOSIS — SUSPECT QUERY (Biopsy procedures + FIB-4 ≥ 3.25)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Flag "cirrhosis" suspects from:
       (A) Liver-biopsy procedures (CPT), and/or
       (B) FIB-4 computed from same-day AST/ALT/Platelets:
           FIB-4 = (Age yrs × AST [U/L]) / (Platelets [10^9/L] × SQRT(ALT [U/L]))
     Exclude patients already diagnosed with hepatic fibrosis/cirrhosis (K74.*).

   New schemas used:
     • CORE__CONDITION   (ICD_10_CM_CODE)
     • CORE__PROCEDURE   (CPT_CODE / CPT_DISPLAY / START_DATE)
     • CORE__OBSERVATION (LOINC_CODE / RESULT / UNITS / START_DATE)
     • CORE__PATIENT     (BIRTH_DATE)
   ============================================================ */

WITH cirrhosis_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'K74%'
),

/* ============================================================
   PROCEDURE PATH
   ============================================================ */
biopsy_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID        AS resource_id,
    'Procedure'           AS resource_type,
    p.CPT_CODE            AS NORMALIZED_CODE,
    p.CPT_DISPLAY         AS NORMALIZED_DESCRIPTION,
    CAST(p.START_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM CORE__PROCEDURE p
  WHERE p.CPT_CODE IN ('47000','47001','47002','47379','47003')
),
biopsy_clean AS (
  SELECT r.*
  FROM biopsy_raw r
  LEFT JOIN cirrhosis_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),
biopsy_suspects AS (
  SELECT
    c.PATIENT_ID,
    'cirrhosis_liver_biopsy' AS suspect_group,
    'K74.6'                  AS suspect_icd10_code,
    'Cirrhosis of liver (biopsy evidence)' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.NORMALIZED_CODE, c.NORMALIZED_DESCRIPTION,
    c.obs_date, c.DATA_SOURCE
  FROM biopsy_clean c
),

/* ============================================================
   LAB PATH (FIB-4)
   ============================================================ */
/* RAW pulls with numeric token + units present */
ast_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE     AS NORMALIZED_CODE,
    o.LOINC_DISPLAY  AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS          AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.START_DATE AS DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE = '1920-8'  -- AST
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),
alt_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE     AS NORMALIZED_CODE,
    o.LOINC_DISPLAY  AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS          AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.START_DATE AS DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE = '1742-6'  -- ALT
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),
plt_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE     AS NORMALIZED_CODE,
    o.LOINC_DISPLAY  AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS          AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.START_DATE AS DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE IN ('777-3','26515-7')  -- Platelets
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

/* Canonicalize AST/ALT → U/L, Platelets → 10^9/L (only helpful patterns) */
ast_norm AS (
  SELECT
    r.*,
    UPPER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[\\s{}\\[\\]()]', '')) AS units_key,
    TRY_TO_DOUBLE(r.value_token) AS ast_raw
  FROM ast_raw r
),
ast_clean AS (
  SELECT *
  FROM (
    SELECT
      *,
      CASE WHEN REGEXP_LIKE(units_key, '^(IU|U|UNIT|UNITS)/L$') THEN ast_raw ELSE NULL END AS ast_u_l
    FROM ast_norm
  )
  WHERE ast_u_l IS NOT NULL AND ast_u_l > 0 AND ast_u_l <= 10000
),
alt_norm AS (
  SELECT
    r.*,
    UPPER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[\\s{}\\[\\]()]', '')) AS units_key,
    TRY_TO_DOUBLE(r.value_token) AS alt_raw
  FROM alt_raw r
),
alt_clean AS (
  SELECT *
  FROM (
    SELECT
      *,
      CASE WHEN REGEXP_LIKE(units_key, '^(IU|U|UNIT|UNITS)/L$') THEN alt_raw ELSE NULL END AS alt_u_l
    FROM alt_norm
  )
  WHERE alt_u_l IS NOT NULL AND alt_u_l > 0 AND alt_u_l <= 10000
),
plt_norm AS (
  SELECT
    r.*,
    UPPER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[\\s{}\\[\\]()]', '')) AS units_key,
    TRY_TO_DOUBLE(r.value_token) AS plt_raw
  FROM plt_raw r
),
plt_clean AS (
  SELECT *
  FROM (
    SELECT
      *,
      CASE
        /* 10^9/L family */
        WHEN REGEXP_LIKE(units_key, '^(10\\^9|10\\*9|10E9)/L$') THEN plt_raw
        /* 10^3/uL or /mcL family (numeric equals 10^9/L scale) */
        WHEN REGEXP_LIKE(units_key, '^(10\\^3|10\\*3|10E3|X10E3|X10\\(3\\)|10_3|X10_3|10X3)/(UL|MCL)$') THEN plt_raw
        /* /mm3 family */
        WHEN REGEXP_LIKE(units_key, '^(10\\^3|10\\*3|10E3|1000)/MM3$') THEN plt_raw
        /* K (thousand) forms */
        WHEN REGEXP_LIKE(units_key, '^K/(UL|MCL|MM3)$') THEN plt_raw
        /* TH/THOUS words */
        WHEN REGEXP_LIKE(units_key, '^TH(OU?S)?/(UL|MM3)$') THEN plt_raw
        ELSE NULL
      END AS plt_10e9_l
    FROM plt_norm
  )
  WHERE plt_10e9_l IS NOT NULL AND plt_10e9_l > 0 AND plt_10e9_l <= 2000
),

/* Apply dx exclusion to each cleaned lab set */
ast_clean_ex AS (
  SELECT a.*
  FROM ast_clean a
  LEFT JOIN cirrhosis_dx_exclusion x ON x.PATIENT_ID = a.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),
alt_clean_ex AS (
  SELECT a.*
  FROM alt_clean a
  LEFT JOIN cirrhosis_dx_exclusion x ON x.PATIENT_ID = a.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),
plt_clean_ex AS (
  SELECT p.*
  FROM plt_clean p
  LEFT JOIN cirrhosis_dx_exclusion x ON x.PATIENT_ID = p.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* Age at lab date */
patient_birth AS (
  SELECT PATIENT_ID, CAST(BIRTH_DATE AS DATE) AS birth_date
  FROM CORE__PATIENT
  WHERE BIRTH_DATE IS NOT NULL
),

/* FIB-4 from SAME-DAY triplets */
fib4_candidates AS (
  SELECT
    a.PATIENT_ID,
    a.obs_date,
    DATEDIFF('year', b.birth_date, a.obs_date) AS age_years,
    a.ast_u_l,
    l.alt_u_l,
    p.plt_10e9_l,
    (DATEDIFF('year', b.birth_date, a.obs_date) * a.ast_u_l)
      / NULLIF(p.plt_10e9_l * SQRT(l.alt_u_l), 0) AS fib4_value
  FROM ast_clean_ex a
  JOIN alt_clean_ex l ON l.PATIENT_ID = a.PATIENT_ID AND l.obs_date = a.obs_date
  JOIN plt_clean_ex p ON p.PATIENT_ID = a.PATIENT_ID AND p.obs_date = a.obs_date
  JOIN patient_birth b ON b.PATIENT_ID = a.PATIENT_ID
),
fib4_positive AS (
  SELECT *
  FROM fib4_candidates
  WHERE fib4_value >= 3.25
),

/* Emit supporting AST/ALT/PLT rows for every FIB-4+ day */
fib4_supporting AS (
  SELECT
    a.PATIENT_ID,
    'cirrhosis_fib4_high' AS suspect_group,
    'K74.6'               AS suspect_icd10_code,
    'Cirrhosis of liver (FIB-4 ≥ 3.25)' AS suspect_icd10_short_description,
    a.resource_id, a.resource_type, a.NORMALIZED_CODE, a.NORMALIZED_DESCRIPTION,
    a.RESULT, 'U/L' AS units, a.ast_u_l AS value_num, a.obs_date, a.DATA_SOURCE
  FROM ast_clean_ex a
  JOIN fib4_positive f USING (PATIENT_ID, obs_date)

  UNION ALL

  SELECT
    l.PATIENT_ID, 'cirrhosis_fib4_high', 'K74.6',
    'Cirrhosis of liver (FIB-4 ≥ 3.25)',
    l.resource_id, l.resource_type, l.NORMALIZED_CODE, l.NORMALIZED_DESCRIPTION,
    l.RESULT, 'U/L', l.alt_u_l, l.obs_date, l.DATA_SOURCE
  FROM alt_clean_ex l
  JOIN fib4_positive f USING (PATIENT_ID, obs_date)

  UNION ALL

  SELECT
    p.PATIENT_ID, 'cirrhosis_fib4_high', 'K74.6',
    'Cirrhosis of liver (FIB-4 ≥ 3.25)',
    p.resource_id, p.resource_type, p.NORMALIZED_CODE, p.NORMALIZED_DESCRIPTION,
    p.RESULT, '10^9/L', p.plt_10e9_l, p.obs_date, p.DATA_SOURCE
  FROM plt_clean_ex p
  JOIN fib4_positive f USING (PATIENT_ID, obs_date)
),

/* FHIR builds (ensure identical column order in both branches) */
biopsy_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    s.resource_type,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.obs_date,
    s.DATA_SOURCE AS data_source,
    OBJECT_CONSTRUCT(
      'resourceType','Procedure',
      'id',s.resource_id,
      'status','completed',
      'code',OBJECT_CONSTRUCT(
        'text',NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding',ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',s.NORMALIZED_CODE,'display',s.NORMALIZED_DESCRIPTION)
        )
      ),
      'effectiveDateTime',TO_CHAR(s.obs_date,'YYYY-MM-DD')
    ) AS fhir
  FROM biopsy_suspects s
),
labs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    s.resource_type,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.obs_date,
    s.DATA_SOURCE AS data_source,
    OBJECT_CONSTRUCT(
      'resourceType','Observation',
      'id',s.resource_id,
      'status','final',
      'code',OBJECT_CONSTRUCT(
        'text',NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding',ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',s.NORMALIZED_CODE,'display',s.NORMALIZED_DESCRIPTION)
        )
      ),
      'effectiveDateTime',TO_CHAR(s.obs_date,'YYYY-MM-DD'),
      'valueQuantity',OBJECT_CONSTRUCT('value',s.value_num,'unit',s.units),
      'valueString',IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir
  FROM fib4_supporting s
),
all_with_fhir AS (
  SELECT * FROM biopsy_with_fhir
  UNION ALL
  SELECT * FROM labs_with_fhir
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
      'id',resource_id,
      'resource_type',resource_type,
      'data_source',data_source,
      'fhir',fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM all_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
