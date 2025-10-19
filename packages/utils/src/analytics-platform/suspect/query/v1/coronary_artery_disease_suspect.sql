/* ============================================================
   CORONARY ARTERY DISEASE (CAD) — SUSPECT QUERY (unit inference)
   ------------------------------------------------------------
   Evidence paths:
     (A) Troponin I/T above conservative cutoffs (ng/L)
         - 10839-9 (cTnI) ≥ 40 ng/L
         - 6598-7  (cTnT) ≥ 14 ng/L
     (B) Prior revascularization procedures:
         - PCI stent: 92928, 92929
         - CABG: 33511, 33512
   Exclude: ICD-10 I25.*
   Key change: infer units from RESULT if UNITS is blank; lenient unit parsing.
   ============================================================ */

WITH cad_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'I25%'
),

/* -------------------------
   RAW: Troponin rows (no hard requirement on UNITS)
   ------------------------- */
troponin_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID AS resource_id,
    'Observation'    AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    /* infer units from RESULT if UNITS is blank */
    COALESCE(
      NULLIF(o.UNITS,''),
      CASE
        WHEN UPPER(o.RESULT) LIKE '%NG/L%'  THEN 'ng/L'
        WHEN UPPER(o.RESULT) LIKE '%NG/ML%' THEN 'ng/mL'
        WHEN UPPER(o.RESULT) LIKE '%PG/ML%' THEN 'pg/mL'
        WHEN UPPER(o.RESULT) LIKE '%UG/L%'  THEN 'ug/L'
        WHEN UPPER(o.RESULT) LIKE '%ΜG/L%'  THEN 'ug/L'   -- Greek mu
        WHEN UPPER(o.RESULT) LIKE '%µG/L%'  THEN 'ug/L'   -- micro symbol
        ELSE NULL
      END
    ) AS units_raw,
    /* capture number incl. scientific notation */
    REGEXP_SUBSTR(
      REPLACE(o.RESULT, ',', ''),
      '[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?'
    ) AS value_token,
    CAST(o.START_DATE AS DATE) AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE IN ('10839-9','6598-7')
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''),
        '[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?') IS NOT NULL
),

/* -------------------------
   NORM: Troponin → ng/L (lenient unit matching)
   ------------------------- */
troponin_norm AS (
  SELECT
    r.*,
    /* normalize micro sign to 'u' then strip non-alphanum into a compact key */
    REGEXP_REPLACE(LOWER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[µμ]', 'u')), '[^a-z0-9]+', '') AS unit_key,
    CASE
      WHEN REGEXP_REPLACE(LOWER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[µμ]', 'u')), '[^a-z0-9]+', '') LIKE 'ngl%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN REGEXP_REPLACE(LOWER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[µμ]', 'u')), '[^a-z0-9]+', '') LIKE 'ngml%' THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN REGEXP_REPLACE(LOWER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[µμ]', 'u')), '[^a-z0-9]+', '') LIKE 'pgml%' THEN TRY_TO_DOUBLE(r.value_token)           -- 1 pg/mL = 1 ng/L
      WHEN REGEXP_REPLACE(LOWER(REGEXP_REPLACE(COALESCE(r.units_raw,''), '[µμ]', 'u')), '[^a-z0-9]+', '') LIKE 'ugl%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      ELSE NULL
    END AS value_ng_l,
    'ng/L' AS units
  FROM troponin_raw r
),

troponin_clean AS (
  SELECT n.*
  FROM troponin_norm n
  LEFT JOIN cad_dx_exclusion x ON x.PATIENT_ID = n.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
    AND n.value_ng_l IS NOT NULL
    AND n.value_ng_l > 0
    AND n.value_ng_l <= 20000
),

/* -------------------------
   RAW/NORM/CLEAN: Revascularization procedures
   ------------------------- */
revasc_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID AS resource_id,
    'Procedure'    AS resource_type,
    p.CPT_CODE     AS NORMALIZED_CODE,
    p.CPT_DISPLAY  AS NORMALIZED_DESCRIPTION,
    CAST(p.START_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM CORE__PROCEDURE p
  WHERE p.CPT_CODE IN ('92928','92929','33511','33512')
),
revasc_clean AS (
  SELECT r.*
  FROM revasc_raw r
  LEFT JOIN cad_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* -------------------------
   SUSPECT buckets
   ------------------------- */
troponin_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.LOINC_CODE = '10839-9' AND c.value_ng_l >= 40 THEN 'cad_troponin_i_high'
      WHEN c.LOINC_CODE = '6598-7'  AND c.value_ng_l >= 14 THEN 'cad_troponin_t_high'
      ELSE NULL
    END AS suspect_group,
    'I25.10' AS suspect_icd10_code,
    'Atherosclerotic heart disease of native coronary artery without angina pectoris'
      AS suspect_icd10_short_description,
    c.resource_id, c.resource_type,
    c.LOINC_CODE     AS NORMALIZED_CODE,
    c.LOINC_DISPLAY  AS NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    c.value_ng_l     AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM troponin_clean c
  WHERE (c.LOINC_CODE = '10839-9' AND c.value_ng_l >= 40)
     OR (c.LOINC_CODE = '6598-7'  AND c.value_ng_l >= 14)
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
    c.resource_id, c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    NULL AS RESULT,
    NULL AS units,
    NULL AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM revasc_clean c
),

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
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType', s.resource_type,
      'id',            s.resource_id,
      'status',        CASE WHEN s.resource_type = 'Procedure' THEN 'completed' ELSE 'final' END,
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  CASE WHEN s.resource_type = 'Observation' THEN 'http://loinc.org'
                            ELSE 'http://www.ama-assn.org/go/cpt' END,
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(s.resource_type = 'Observation' AND s.value_num IS NOT NULL,
            OBJECT_CONSTRUCT('value', s.value_num, 'unit', 'ng/L'), NULL),
      'valueString',
        IFF(s.resource_type = 'Observation'
            AND TRY_TO_DOUBLE(REPLACE(s.RESULT, '%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id, s.resource_type, s.DATA_SOURCE AS data_source
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
  ARRAY_AGG(OBJECT_CONSTRUCT(
    'id', resource_id,
    'resource_type', resource_type,
    'data_source',   data_source,
    'fhir',          fhir
  )) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM cad_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
