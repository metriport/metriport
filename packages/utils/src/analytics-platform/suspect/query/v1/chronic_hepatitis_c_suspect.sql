/* ============================================================
   CHRONIC HEPATITIS C — SUSPECT QUERY (Labs + DAA meds)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Flag "chronic Hep C" suspects from:
       (A) HCV lab results (LOINCs: 13955-0, 16128-1, 11011-4,
           38180-6, 32286-7, 48159-8) where numeric value > 0
       (B) Direct-acting antiviral treatment (Rx), excluding ribavirin
     while EXCLUDING anyone already diagnosed with chronic Hep C.

   Dx Exclusion
     - ICD-10-CM: B18.2*  (Chronic viral hepatitis C)

   Notes
     - Labs are numeric-only (no unit normalization).
     - Meds matched against RXNORM/NDC display for common DAAs.
     - Ribavirin explicitly excluded.

   New schemas used:
     • CORE__OBSERVATION        (labs)
     • CORE__CONDITION          (dx exclusions)
     • CORE_V3.CORE__MEDICATION_REQUEST + CORE_V3.CORE__MEDICATION (DAA Rx)
   ============================================================ */

WITH hepc_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'B18.2%'
),

/* -------------------------
   RAW: all six LOINCs in one pull; extract numeric token
   ------------------------- */
hcv_lab_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE                   AS NORMALIZED_CODE,
    o.LOINC_DISPLAY                AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS                        AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                         AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE IN ('13955-0','16128-1','11011-4','38180-6','32286-7','48159-8')
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
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
  SELECT n.*
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
   ------------------------- */
med_daa_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                                        AS resource_id,
    'MedicationRequest'                                             AS resource_type,
    COALESCE(NULLIF(m.RXNORM_CODE,''), NULLIF(m.NDC_CODE,''))       AS NORMALIZED_CODE,
    COALESCE(NULLIF(m.RXNORM_DISPLAY,''), NULLIF(m.NDC_DISPLAY,'')) AS NORMALIZED_DESCRIPTION,
    COALESCE(NULLIF(m.RXNORM_DISPLAY,''), NULLIF(m.NDC_DISPLAY,'')) AS RESULT,
    NULL                                                            AS units,
    CAST(mr.AUTHORED_ON AS DATE)                                    AS obs_date,
    COALESCE(NULLIF(mr.STATUS,''),'active')                         AS mr_status,
    mr.DATA_SOURCE
  FROM CORE_V3.CORE__MEDICATION_REQUEST mr
  JOIN CORE_V3.CORE__MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE mr.AUTHORED_ON IS NOT NULL
    AND (
      /* Generics */
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%sofosbuvir%'    OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%ledipasvir%'    OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%velpatasvir%'   OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%voxilaprevir%'  OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%glecaprevir%'   OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%pibrentasvir%'  OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%elbasvir%'      OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%grazoprevir%'   OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%daclatasvir%'   OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%simeprevir%'    OR
      /* Brands */
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%harvoni%'       OR -- ledipasvir/sofosbuvir
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%epclusa%'       OR -- sofosbuvir/velpatasvir
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%vosevi%'        OR -- sofosbuvir/velpatasvir/voxilaprevir
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%mavyret%'       OR -- glecaprevir/pibrentasvir
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%zepatier%'         -- elbasvir/grazoprevir
    )
    AND LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) NOT LIKE '%ribavirin%'
),

/* -------------------------
   CLEAN (Meds): exclude known chronic dx
   ------------------------- */
med_daa_clean AS (
  SELECT *
  FROM med_daa_raw n
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
    c.DATA_SOURCE,
    c.mr_status
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

    CASE
      WHEN s.resource_type = 'Observation' THEN
        OBJECT_CONSTRUCT(
          'resourceType', 'Observation',
          'id',           s.resource_id,
          'status',       'final',
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
          'valueQuantity', OBJECT_CONSTRUCT('value', s.value_num, 'unit', s.units),
          'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
        )
      ELSE
        OBJECT_CONSTRUCT(
          'resourceType', 'MedicationRequest',
          'id',           s.resource_id,
          'status',       COALESCE(s.mr_status,'active'),
          'intent',       'order',
          'medicationCodeableConcept', OBJECT_CONSTRUCT(
            'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system',  'http://www.nlm.nih.gov/research/umls/rxnorm',
                'code',     s.NORMALIZED_CODE,
                'display',  s.NORMALIZED_DESCRIPTION
              )
            )
          ),
          'authoredOn', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
        )
    END AS fhir,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM (
    /* ensure both branches have identical columns (14) */
    SELECT
      PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description,
      resource_id, resource_type, NORMALIZED_CODE, NORMALIZED_DESCRIPTION,
      RESULT, units, value_num, obs_date, DATA_SOURCE,
      CAST(NULL AS VARCHAR) AS mr_status
    FROM hepc_lab_suspects
    UNION ALL
    SELECT
      PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description,
      resource_id, resource_type, NORMALIZED_CODE, NORMALIZED_DESCRIPTION,
      RESULT, units, value_num, obs_date, DATA_SOURCE, mr_status
    FROM hepc_med_suspects
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
