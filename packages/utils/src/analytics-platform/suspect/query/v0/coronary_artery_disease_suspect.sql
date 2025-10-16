/* ============================================================
   CORONARY ARTERY DISEASE (CAD) — SUSPECT QUERY
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag CAD suspects using two evidence paths:
       (A) Troponin I/T above conservative cutoffs (normalized to ng/L)
           - LOINC 10839-9 (cTnI) ≥ 40 ng/L
           - LOINC 6598-7  (cTnT) ≥ 14 ng/L
       (B) Prior revascularization procedures:
           - PCI stent (CPT 92928, 92929)
           - CABG (CPT 33511, 33512)
     Exclude anyone with existing CAD diagnosis (ICD-10 I25.*).
   ============================================================ */

WITH cad_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I25%'
),

/* -------------------------
   RAW: pull rows (Troponin & Procedures)
   ------------------------- */
troponin_raw AS (
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
    AND lr.NORMALIZED_CODE IN ('10839-9','6598-7')      -- cTnI, cTnT
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) IS NOT NULL
),

revasc_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID          AS resource_id,
    'Procedure'             AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE p.NORMALIZED_CODE IN ('92928','92929','33511','33512')  -- PCI / CABG
),

/* -------------------------
   NORM: canonicalize (Troponin → ng/L; Procedures pass-through)
   ------------------------- */
troponin_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)      -- 1 pg/mL == 1 ng/L
      WHEN r.units_raw ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      ELSE NULL
    END AS value_ng_l,
    'ng/L' AS units
  FROM troponin_raw r
),

revasc_norm AS (
  SELECT * FROM revasc_raw
),

/* -------------------------
   CLEAN: plausibility & diagnosis exclusions
   ------------------------- */
troponin_clean AS (
  SELECT *
  FROM troponin_norm n
  WHERE n.value_ng_l IS NOT NULL
    AND n.value_ng_l > 0
    AND n.value_ng_l <= 20000
    AND NOT EXISTS (SELECT 1 FROM cad_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

revasc_clean AS (
  SELECT *
  FROM revasc_norm n
  WHERE NOT EXISTS (SELECT 1 FROM cad_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: assign buckets for each path
   ------------------------- */
troponin_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.NORMALIZED_CODE = '10839-9' AND c.value_ng_l >= 40 THEN 'cad_troponin_i_high'
      WHEN c.NORMALIZED_CODE = '6598-7'  AND c.value_ng_l >= 14 THEN 'cad_troponin_t_high'
      ELSE NULL
    END AS suspect_group,
    'I25.10' AS suspect_icd10_code,
    'Atherosclerotic heart disease of native coronary artery without angina pectoris'
      AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,                  -- canonical 'ng/L'
    c.value_ng_l AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM troponin_clean c
  WHERE
    (c.NORMALIZED_CODE = '10839-9' AND c.value_ng_l >= 40)
    OR
    (c.NORMALIZED_CODE = '6598-7'  AND c.value_ng_l >= 14)
),

revasc_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.NORMALIZED_CODE IN ('92928','92929') THEN 'cad_prior_pci'
      WHEN c.NORMALIZED_CODE IN ('33511','33512') THEN 'cad_prior_cabg'
      ELSE NULL
    END AS suspect_group,
    'I25.10' AS suspect_icd10_code,
    'Atherosclerotic heart disease of native coronary artery without angina pectoris'
      AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    NULL AS RESULT,
    NULL AS units,
    NULL AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM revasc_clean c
  WHERE c.NORMALIZED_CODE IN ('92928','92929','33511','33512')
),

/* -------------------------
   Combine suspects
   ------------------------- */
all_cad_suspects AS (
  SELECT * FROM troponin_suspects WHERE suspect_group IS NOT NULL
  UNION ALL
  SELECT * FROM revasc_suspects  WHERE suspect_group IS NOT NULL
),

/* -------------------------
   FHIR
   ------------------------- */
cad_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType', s.resource_type,
      'id',            s.resource_id,
      'status',        CASE WHEN s.resource_type = 'Procedure' THEN 'completed' ELSE 'final' END,
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  CASE
                         WHEN s.resource_type = 'Observation' THEN 'http://loinc.org'
                         ELSE 'http://www.ama-assn.org/go/cpt'
                       END,
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      /* Date placement for both types (UI-ready) */
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(s.resource_type = 'Observation' AND s.value_num IS NOT NULL,
            OBJECT_CONSTRUCT('value', s.value_num, 'unit', 'ng/L'),
            NULL),
      'valueString',
        IFF(s.resource_type = 'Observation' AND TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM all_cad_suspects s
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
FROM cad_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
