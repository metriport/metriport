/* ============================================================
   HEART FAILURE — SUSPECT QUERY (BNP/NT-proBNP + Echo + Symptom)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "heart failure" suspects when ALL are present:
       (A) Elevated natriuretic peptide:
           • BNP (LOINC 30934-4, 42637-9) > 100 pg/mL
           • NT-proBNP (LOINC 33762-6, 83107-3) > 300 pg/mL
       (B) Echocardiography procedure present
       (C) ≥1 compatible symptom/diagnosis (dyspnea, fatigue,
           chest pain, edema, JVD)
     while excluding anyone already diagnosed with HF (ICD-10 I50.*).
   ============================================================ */

WITH hf_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I50%'
),

/* -------------------------
   RAW
   ------------------------- */
peptide_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                      AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                        AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('30934-4','42637-9','33762-6','83107-3')
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) IS NOT NULL
),

echo_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                                     AS resource_id,
    'Procedure'                                        AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE)                     AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE (p.NORMALIZED_DESCRIPTION ILIKE '%echocardiography%'
      OR p.NORMALIZED_CODE IN ('93306','93307','C8929'))
),

symptom_raw AS (
  SELECT
    c.PATIENT_ID,
    c.CONDITION_ID                                     AS resource_id,
    'Condition'                                        AS resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    COALESCE(CAST(c.ONSET_DATE AS DATE),
             CAST(c.RECORDED_DATE AS DATE),
             CAST(c.RESOLVED_DATE AS DATE))            AS obs_date,
    c.DATA_SOURCE
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND (
         c.NORMALIZED_CODE LIKE 'R060%'   -- dyspnea
      OR c.NORMALIZED_CODE = 'R5383'      -- fatigue
      OR c.NORMALIZED_CODE LIKE 'R079%'   -- chest pain
      OR c.NORMALIZED_CODE LIKE 'R60%'    -- edema
      OR c.NORMALIZED_CODE = 'R0989'      -- JVD
    )
),

/* -------------------------
   NORM
   ------------------------- */
/* Units seen: ng/L, pg/mL (PG/ML, pG/mL), ng/mL, ng/dL, (mg/dL → ignored)
   Canonical numeric → pg/mL; canonical units → 'pg/mL' */
peptide_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)              -- pg/mL
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)              -- ng/L == pg/mL
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0     -- ng/mL → pg/mL
      WHEN r.units_raw ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0     -- µg/L → pg/mL
      WHEN r.units_raw ILIKE '%ng/dl%' THEN TRY_TO_DOUBLE(r.value_token) * 10.0       -- ng/dL → pg/mL
      WHEN r.units_raw ILIKE '%mg/dl%' THEN NULL                                      -- implausible for BNP; drop
      ELSE NULL
    END AS value_pg_ml,
    'pg/mL' AS units
  FROM peptide_raw r
),

echo_norm AS (SELECT * FROM echo_raw),
symptom_norm AS (SELECT * FROM symptom_raw),

/* -------------------------
   CLEAN
   ------------------------- */
peptide_clean AS (
  SELECT *
  FROM peptide_norm n
  WHERE n.value_pg_ml IS NOT NULL
    AND n.value_pg_ml > 0
    AND n.value_pg_ml <= 100000
    AND NOT EXISTS (SELECT 1 FROM hf_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
echo_clean AS (
  SELECT *
  FROM echo_norm n
  WHERE NOT EXISTS (SELECT 1 FROM hf_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
symptom_clean AS (
  SELECT *
  FROM symptom_norm n
  WHERE NOT EXISTS (SELECT 1 FROM hf_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT
   ------------------------- */
peptide_above_cutoff AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    NULL              AS RESULT,
    c.units,
    c.value_pg_ml     AS value_num,
    c.obs_date,
    c.DATA_SOURCE,
    CASE
      WHEN c.NORMALIZED_CODE IN ('30934-4','42637-9')  AND c.value_pg_ml > 100 THEN 'hf_peptide_bnpover100'
      WHEN c.NORMALIZED_CODE IN ('33762-6','83107-3')  AND c.value_pg_ml > 300 THEN 'hf_peptide_ntprobnp_over300'
      ELSE NULL
    END AS peptide_flag
  FROM peptide_clean c
  WHERE (
         (c.NORMALIZED_CODE IN ('30934-4','42637-9')  AND c.value_pg_ml > 100)
      OR (c.NORMALIZED_CODE IN ('33762-6','83107-3')  AND c.value_pg_ml > 300)
  )
),
patients_with_all AS (
  SELECT DISTINCT p.PATIENT_ID
  FROM peptide_above_cutoff p
  JOIN echo_clean e    ON e.PATIENT_ID = p.PATIENT_ID
  JOIN symptom_clean s ON s.PATIENT_ID = p.PATIENT_ID
),

hf_supporting AS (
  SELECT
    p.PATIENT_ID,
    'hf_combined_suspect'         AS suspect_group,
    'I50.9'                       AS suspect_icd10_code,
    'Heart failure, unspecified'  AS suspect_icd10_short_description,
    p.resource_id,
    p.resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    NULL        AS RESULT,
    p.units,
    p.value_num,
    p.obs_date,
    p.DATA_SOURCE
  FROM peptide_above_cutoff p
  WHERE p.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)

  UNION ALL
  SELECT
    e.PATIENT_ID,
    'hf_combined_suspect',
    'I50.9',
    'Heart failure, unspecified',
    e.resource_id,
    e.resource_type,
    e.NORMALIZED_CODE,
    e.NORMALIZED_DESCRIPTION,
    NULL,
    NULL,
    NULL,
    e.obs_date,
    e.DATA_SOURCE
  FROM echo_clean e
  WHERE e.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)

  UNION ALL
  SELECT
    s.PATIENT_ID,
    'hf_combined_suspect',
    'I50.9',
    'Heart failure, unspecified',
    s.resource_id,
    s.resource_type,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    NULL,
    NULL,
    NULL,
    s.obs_date,
    s.DATA_SOURCE
  FROM symptom_clean s
  WHERE s.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)
),

/* -------------------------
   FHIR
   ------------------------- */
with_fhir AS (
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType', f.resource_type,
      'id',            f.resource_id,
      'status',        CASE
                         WHEN f.resource_type = 'Procedure' THEN 'completed'
                         WHEN f.resource_type = 'Observation' THEN 'final'
                         ELSE NULL
                       END,
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(f.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  CASE
                         WHEN f.resource_type = 'Observation' THEN 'http://loinc.org'
                         WHEN f.resource_type = 'Condition'   THEN 'http://hl7.org/fhir/sid/icd-10-cm'
                         WHEN f.resource_type = 'Procedure'   THEN 'http://www.ama-assn.org/go/cpt'
                       END,
            'code',     f.NORMALIZED_CODE,
            'display',  f.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(f.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(f.resource_type = 'Observation' AND f.value_num IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', f.value_num,
              'unit',  f.units
            ),
            NULL)
    ) AS fhir,
    f.resource_id,
    f.resource_type,
    f.DATA_SOURCE AS data_source
  FROM hf_supporting f
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
FROM with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
