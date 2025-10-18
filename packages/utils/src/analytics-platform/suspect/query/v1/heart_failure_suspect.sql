/* ============================================================
   HEART FAILURE — SUSPECT QUERY (BNP/NT-proBNP + Echo + Symptom)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "heart failure" suspects when ALL are present:
       (A) Elevated natriuretic peptide:
           • BNP (LOINC 30934-4, 42637-9) > 100 pg/mL
           • NT-proBNP (LOINC 33762-6, 83107-3) > 300 pg/mL
       (B) Echocardiography procedure present
       (C) ≥1 compatible symptom/diagnosis (dyspnea, fatigue,
           chest pain, edema, JVD)
     Exclusion: already diagnosed with heart failure (ICD-10 I50.*).

   Tables used (CORE_V3):
     • CORE__OBSERVATION (LOINC labs)
     • CORE__PROCEDURE   (CPT/SNOMED echocardiography)
     • CORE__CONDITION   (ICD-10 symptoms)
   ============================================================ */

WITH hf_dx_exclusion AS (
  /* Exclude patients already diagnosed with heart failure (I50.*) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'I50%'
),

/* -------------------------
   RAW (OBSERVATION): BNP / NT-proBNP
   ------------------------- */
peptide_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                               AS resource_id,
    'Observation'                                   AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                         AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.START_DATE, o.END_DATE)              AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '30934-4',  -- BNP [Mass/volume] in Serum/Plasma
    '42637-9',  -- BNP [Substance/amount] in Serum/Plasma
    '33762-6',  -- NT-proBNP [Mass/volume] in Serum/Plasma
    '83107-3'   -- NT-proBNP [Substance/amount] in Serum/Plasma
  )
  AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   RAW (PROCEDURE): Echocardiography
   ------------------------- */
echo_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                                AS resource_id,
    'Procedure'                                    AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed')     AS status,
    COALESCE(p.START_DATE, p.END_DATE)             AS obs_date,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,
    p.BODYSITE_SNOMED_CODE                         AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                      AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
       UPPER(p.CPT_CODE) IN (
         '93306',  -- TTE, complete (2D, M-mode, Doppler, color)
         '93307',  -- TTE, 2D with/without M-mode; complete
         'C8929'   -- TTE, complete incl Doppler+color (OPPS C-code)
       )
    /* Match V2 semantics: description contains 'echocardiography' (not generic 'echo') */
    OR UPPER(COALESCE(p.CPT_DISPLAY,''))    LIKE '%ECHOCARDIOGRAPHY%'
    OR UPPER(COALESCE(p.SNOMED_DISPLAY,'')) LIKE '%ECHOCARDIOGRAPHY%'
),

/* -------------------------
   RAW (CONDITION): Compatible symptoms/diagnoses
   ------------------------- */
symptom_raw AS (
  SELECT
    c.PATIENT_ID,
    c.CONDITION_ID                                 AS resource_id,
    'Condition'                                     AS resource_type,
    c.ICD_10_CM_CODE,
    COALESCE(c.START_DATE, c.RECORDED_DATE, c.END_DATE) AS obs_date,
    c.DATA_SOURCE
  FROM CORE_V3.CORE__CONDITION c
  WHERE
       UPPER(c.ICD_10_CM_CODE) LIKE 'R060%'  -- Dyspnea
    OR UPPER(c.ICD_10_CM_CODE) = 'R5383'     -- Other fatigue
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'R079%'  -- Chest pain, unspecified (match V2)
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'R60%'   -- Edema
    OR UPPER(c.ICD_10_CM_CODE) = 'R0989'     -- JVD
),

/* -------------------------
   NORM (BNP/NT-proBNP → pg/mL)
   ------------------------- */
peptide_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(r.value_token)              -- pg/mL
      WHEN r.units_raw ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(r.value_token)              -- ng/L == pg/mL
      WHEN r.units_raw ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0     -- µg/L → pg/mL
      WHEN r.units_raw ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0     -- ng/mL → pg/mL
      WHEN r.units_raw ILIKE '%ng/dl%' THEN TRY_TO_DOUBLE(r.value_token) * 10.0       -- ng/dL → pg/mL
      WHEN r.units_raw ILIKE '%mg/dl%' THEN NULL                                      -- implausible → drop
      ELSE NULL
    END AS value_pg_ml,
    'pg/mL' AS units
  FROM peptide_raw r
),

echo_norm    AS (SELECT * FROM echo_raw),
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
   SUSPECT (A): peptide above cutoff
   ------------------------- */
peptide_above_cutoff AS (
  SELECT
    c.PATIENT_ID,
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units,
    c.value_pg_ml AS value_num,
    c.obs_date,
    c.DATA_SOURCE,
    CASE
      WHEN UPPER(c.LOINC_CODE) IN ('30934-4','42637-9') AND c.value_pg_ml > 100 THEN 'hf_peptide_bnpover100'
      WHEN UPPER(c.LOINC_CODE) IN ('33762-6','83107-3') AND c.value_pg_ml > 300 THEN 'hf_peptide_ntprobnp_over300'
      ELSE NULL
    END AS peptide_flag
  FROM peptide_clean c
  WHERE ( (UPPER(c.LOINC_CODE) IN ('30934-4','42637-9') AND c.value_pg_ml > 100)
       OR (UPPER(c.LOINC_CODE) IN ('33762-6','83107-3') AND c.value_pg_ml > 300) )
),

/* -------------------------
   SUSPECT (B+C): require echo present AND ≥1 compatible symptom
   ------------------------- */
patients_with_all AS (
  SELECT DISTINCT p.PATIENT_ID
  FROM peptide_above_cutoff p
  JOIN echo_clean e    ON e.PATIENT_ID = p.PATIENT_ID
  JOIN symptom_clean s ON s.PATIENT_ID = p.PATIENT_ID
),

/* -------------------------
   Package supporting evidence rows (Obs + Proc + Condition)
   ------------------------- */
hf_supporting AS (
  /* Peptide observations */
  SELECT
    p.PATIENT_ID,
    'hf_combined_suspect'         AS suspect_group,
    'I50.9'                       AS suspect_icd10_code,
    'Heart failure, unspecified'  AS suspect_icd10_short_description,
    p.resource_id,
    p.resource_type,
    /* coding fields (Observation/LOINC) */
    p.LOINC_CODE,
    p.LOINC_DISPLAY,
    /* placeholders for other resource types */
    NULL AS CPT_CODE, NULL AS CPT_DISPLAY,
    NULL AS SNOMED_CODE, NULL AS SNOMED_DISPLAY,
    NULL AS ICD_10_CM_CODE,
    p.RESULT,
    p.units,
    p.value_num,
    p.obs_date,
    p.DATA_SOURCE
  FROM peptide_above_cutoff p
  WHERE p.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)

  UNION ALL

  /* Echo procedures */
  SELECT
    e.PATIENT_ID,
    'hf_combined_suspect',
    'I50.9',
    'Heart failure, unspecified',
    e.resource_id,
    e.resource_type,
    NULL AS LOINC_CODE, NULL AS LOINC_DISPLAY,
    e.CPT_CODE, e.CPT_DISPLAY,
    e.SNOMED_CODE, e.SNOMED_DISPLAY,
    NULL AS ICD_10_CM_CODE,
    NULL AS RESULT,
    NULL AS units,
    NULL AS value_num,
    e.obs_date,
    e.DATA_SOURCE
  FROM echo_clean e
  WHERE e.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)

  UNION ALL

  /* Symptom conditions */
  SELECT
    s.PATIENT_ID,
    'hf_combined_suspect',
    'I50.9',
    'Heart failure, unspecified',
    s.resource_id,
    s.resource_type,
    NULL AS LOINC_CODE, NULL AS LOINC_DISPLAY,
    NULL AS CPT_CODE, NULL AS CPT_DISPLAY,
    NULL AS SNOMED_CODE, NULL AS SNOMED_DISPLAY,
    s.ICD_10_CM_CODE,
    NULL AS RESULT,
    NULL AS units,
    NULL AS value_num,
    s.obs_date,
    s.DATA_SOURCE
  FROM symptom_clean s
  WHERE s.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)
),

/* -------------------------
   FHIR BUILDERS
   ------------------------- */
hf_with_fhir_observation AS (
  SELECT
    f.PATIENT_ID, f.suspect_group, f.suspect_icd10_code, f.suspect_icd10_short_description,
    f.resource_id, 'Observation' AS resource_type, f.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
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
      'valueString', IFF(TRY_TO_DOUBLE(f.RESULT) IS NULL, f.RESULT, NULL)
    ) AS fhir
  FROM hf_supporting f
  WHERE f.resource_type = 'Observation'
),

hf_with_fhir_procedure AS (
  SELECT
    f.PATIENT_ID, f.suspect_group, f.suspect_icd10_code, f.suspect_icd10_short_description,
    f.resource_id, 'Procedure' AS resource_type, f.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            f.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   COALESCE(NULLIF(f.CPT_DISPLAY,''), NULLIF(f.SNOMED_DISPLAY,'')),
        'coding', ARRAY_CONSTRUCT_COMPACT(
          IFF(f.CPT_CODE   IS NOT NULL AND f.CPT_CODE   <> '', OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',f.CPT_CODE,'display',NULLIF(f.CPT_DISPLAY,'')), NULL),
          IFF(f.SNOMED_CODE IS NOT NULL AND f.SNOMED_CODE <> '', OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',f.SNOMED_CODE,'display',NULLIF(f.SNOMED_DISPLAY,'')), NULL)
        )
      ),
      'effectiveDateTime', IFF(f.obs_date IS NOT NULL, TO_CHAR(f.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM hf_supporting f
  WHERE f.resource_type = 'Procedure'
),

hf_with_fhir_condition AS (
  SELECT
    f.PATIENT_ID, f.suspect_group, f.suspect_icd10_code, f.suspect_icd10_short_description,
    f.resource_id, 'Condition' AS resource_type, f.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Condition',
      'id',            f.resource_id,
      'code', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://hl7.org/fhir/sid/icd-10-cm','code',f.ICD_10_CM_CODE)
        )
      ),
      'onsetDateTime', IFF(f.obs_date IS NOT NULL, TO_CHAR(f.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM hf_supporting f
  WHERE f.resource_type = 'Condition'
),

hf_with_fhir_all AS (
  SELECT * FROM hf_with_fhir_observation
  UNION ALL
  SELECT * FROM hf_with_fhir_procedure
  UNION ALL
  SELECT * FROM hf_with_fhir_condition
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
FROM hf_with_fhir_all
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
