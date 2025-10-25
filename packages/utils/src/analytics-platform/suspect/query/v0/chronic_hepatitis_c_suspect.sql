/* ============================================================
   CHRONIC HEPATITIS C — SUSPECT QUERY (Labs + DAA meds)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "chronic Hep C" suspects from:
       (A) HCV lab results (LOINC: 13955-0, 16128-1, 11011-4,
           38180-6, 32286-7, 48159-8) where numeric value > 0
       (B) Direct-acting antiviral treatment (Rx), excluding ribavirin
     while EXCLUDING anyone already diagnosed with chronic Hep C.

   Dx Exclusion
     - ICD-10-CM: B18.2*  (Chronic viral hepatitis C)

   Notes
     - Labs here are treated as numeric-only (no text parsing).
     - Meds matched via REGEXP_LIKE on descriptions for common DAAs.
     - Ribavirin explicitly excluded.
   ============================================================ */

WITH hepc_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'B182%'
),

/* -------------------------
   RAW: all six LOINCs in one pull; extract numeric token
   ------------------------- */
hcv_lab_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                                     AS resource_id,
    'Observation'                                                        AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                                         AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('13955-0','16128-1','11011-4','38180-6','32286-7','48159-8')
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM: numeric-only (no unit conversion)
   ------------------------- */
hcv_lab_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_num
  FROM hcv_lab_raw r
),

/* -------------------------
   CLEAN: require numeric > 0 and exclude known chronic dx
   ------------------------- */
hcv_lab_clean AS (
  SELECT
    n.*
  FROM hcv_lab_norm n
  WHERE n.value_num IS NOT NULL
    AND n.value_num > 0
    AND NOT EXISTS (SELECT 1 FROM hepc_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT (Labs): any positive numeric across the six LOINCs
   ------------------------- */
hepc_lab_suspects AS (
  SELECT
    c.PATIENT_ID,
    'chronic_hepc_lab_positive' AS suspect_group,
    'B18.2'                     AS suspect_icd10_code,
    'Chronic viral hepatitis C (screen positive lab)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units_raw AS units,
    c.value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM hcv_lab_clean c
),

/* -------------------------
   RAW (Meds): DAA treatment signal (exclude ribavirin)
   https://www.hepatitisc.uw.edu/page/treatment/drugs 
   ------------------------- */
med_daa_raw AS (
  SELECT
    m.PATIENT_ID,
    m.MEDICATION_ID                                                   AS resource_id,
    'MedicationStatement'                                             AS resource_type,
    COALESCE(NULLIF(m.RXNORM_CODE,''), NULLIF(m.SOURCE_CODE,''))      AS NORMALIZED_CODE,
    COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) AS NORMALIZED_DESCRIPTION,
    COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) AS RESULT,
    NULL                                                              AS units,
    COALESCE(m.DISPENSING_DATE, m.PRESCRIBING_DATE)                   AS obs_date,
    m.DATA_SOURCE
  FROM core_v2.CORE_V2__MEDICATION m
  WHERE
    (
      /* Generics */
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%sofosbuvir%'     OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%ledipasvir%'     OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%velpatasvir%'    OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%voxilaprevir%'   OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%glecaprevir%'    OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%pibrentasvir%'   OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%elbasvir%'       OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%grazoprevir%'    OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%daclatasvir%'    OR
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%simeprevir%'     OR

      /* Brand names (helps when RxNorm/SOURCE description uses brands) */
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%harvoni%'        OR -- ledipasvir/sofosbuvir
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%epclusa%'        OR -- sofosbuvir/velpatasvir
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%vosevi%'         OR -- sofosbuvir/velpatasvir/voxilaprevir
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%mavyret%'        OR -- glecaprevir/pibrentasvir
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%zepatier%'          -- elbasvir/grazoprevir
    
    )
    AND NOT (
      COALESCE(NULLIF(m.RXNORM_DESCRIPTION,''), NULLIF(m.SOURCE_DESCRIPTION,'')) ILIKE '%ribavirin%'
    )
),

/* -------------------------
   NORM (Meds): pass-through
   ------------------------- */
med_daa_norm AS (
  SELECT * FROM med_daa_raw
),

/* -------------------------
   CLEAN (Meds): exclude known chronic dx
   ------------------------- */
med_daa_clean AS (
  SELECT *
  FROM med_daa_norm n
  WHERE NOT EXISTS (SELECT 1 FROM hepc_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT (Meds): DAA treatment as signal
   ------------------------- */
hepc_med_suspects AS (
  SELECT
    c.PATIENT_ID,
    'chronic_hepc_daa_treatment' AS suspect_group,
    'B18.2'                      AS suspect_icd10_code,
    'Chronic viral hepatitis C (treatment signal)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.RESULT,
    c.units,
    NULL AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM med_daa_clean c
),

/* -------------------------
   FHIR: build minimal resource per supporting row
   ------------------------- */
hepc_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType',  s.resource_type,
      'id',            s.resource_id,
      'status',        CASE
                         WHEN s.resource_type = 'Observation'         THEN 'final'
                         WHEN s.resource_type = 'MedicationStatement' THEN 'active'
                         ELSE 'unknown'
                       END,
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  CASE
                         WHEN s.resource_type = 'Observation'         THEN 'http://loinc.org'
                         WHEN s.resource_type = 'MedicationStatement' THEN 'http://www.nlm.nih.gov/research/umls/rxnorm'
                         ELSE NULL
                       END,
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(s.resource_type = 'Observation',
            OBJECT_CONSTRUCT('value', s.value_num, 'unit', s.units),
            NULL),
      'valueString',
        IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM (
    SELECT * FROM hepc_lab_suspects
    UNION ALL
    SELECT * FROM hepc_med_suspects
  ) s
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
FROM hepc_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
