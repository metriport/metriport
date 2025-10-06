/* ============================================================
   HEART FAILURE SUSPECT QUERY
   ------------------------------------------------------------
   Purpose:
   Flag "Heart Failure suspects" when ALL of the following:
     (A) BNP > 100 pg/mL or NT-proBNP > 300 pg/mL
     (B) Echocardiography procedure present
     (C) At least one symptom/diagnosis (dyspnea, fatigue,
         chest pain, edema, JVD)
   while EXCLUDING patients already diagnosed with Heart Failure (ICD-10 I50.*).

   ============================================================ */

WITH hf_dx_exclusion AS (
  -- Patients already diagnosed with HF (I50.*)
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I50%'
),

peptide_hits AS (
  -- BNP / NT-proBNP labs
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID AS resource_id,
    'Observation'    AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    CAST(lr.RESULT_DATE AS DATE) AS obs_date,
    lr.DATA_SOURCE,
    CASE 
      WHEN lr.NORMALIZED_CODE IN ('30934-4','42637-9') 
           AND TRY_TO_DOUBLE(lr.RESULT) > 100
        THEN 'hf_peptide_bnpover100'
      WHEN lr.NORMALIZED_CODE IN ('33762-6','83107-3') 
           AND TRY_TO_DOUBLE(lr.RESULT) > 300
        THEN 'hf_peptide_ntprobnp_over300'
      ELSE NULL
    END AS suspect_group,
    'I50.9' AS suspect_icd10_code,
    'Heart failure, unspecified' AS suspect_icd10_short_description
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE IN ('30934-4','42637-9','33762-6','83107-3')
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM hf_dx_exclusion x WHERE x.PATIENT_ID = lr.PATIENT_ID)
),

echo_hits AS (
  -- Echocardiography procedures
  SELECT
    pr.PATIENT_ID,
    pr.PROCEDURE_ID AS resource_id,
    'Procedure'     AS resource_type,
    pr.NORMALIZED_CODE,
    pr.NORMALIZED_DESCRIPTION,
    NULL AS RESULT,
    NULL AS units,
    CAST(pr.PROCEDURE_DATE AS DATE) AS obs_date,
    pr.DATA_SOURCE,
    'hf_echo_present' AS suspect_group,
    'I50.9' AS suspect_icd10_code,
    'Heart failure, unspecified' AS suspect_icd10_short_description
  FROM core_v2.CORE_V2__PROCEDURE pr
  WHERE (pr.NORMALIZED_DESCRIPTION ILIKE '%echocardiography%'
     OR pr.NORMALIZED_CODE IN ('93306','93307','C8929'))
    AND NOT EXISTS (SELECT 1 FROM hf_dx_exclusion x WHERE x.PATIENT_ID = pr.PATIENT_ID)
),

symptom_hits AS (
  -- Symptom/diagnosis codes
  SELECT
    c.PATIENT_ID,
    c.CONDITION_ID AS resource_id,
    'Condition'    AS resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    NULL AS RESULT,
    NULL AS units,
    COALESCE(CAST(c.ONSET_DATE AS DATE), CAST(c.RECORDED_DATE AS DATE), CAST(c.RESOLVED_DATE AS DATE)) AS obs_date,
    c.DATA_SOURCE,
    'hf_symptom_present' AS suspect_group,
    'I50.9' AS suspect_icd10_code,
    'Heart failure, unspecified' AS suspect_icd10_short_description
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND (
         c.NORMALIZED_CODE LIKE 'R060%'   -- dyspnea
      OR c.NORMALIZED_CODE = 'R5383'     -- fatigue
      OR c.NORMALIZED_CODE LIKE 'R079%'  -- chest pain
      OR c.NORMALIZED_CODE LIKE 'R60%'    -- edema
      OR c.NORMALIZED_CODE = 'R0989'     -- JVD
    )
    AND NOT EXISTS (SELECT 1 FROM hf_dx_exclusion x WHERE x.PATIENT_ID = c.PATIENT_ID)
),

patients_with_all AS (
  -- Require BNP/NT-proBNP + Echo + Symptom
  SELECT DISTINCT p.PATIENT_ID
  FROM peptide_hits p
  JOIN echo_hits e ON e.PATIENT_ID = p.PATIENT_ID
  JOIN symptom_hits s ON s.PATIENT_ID = p.PATIENT_ID
),

all_supporting AS (
  -- Union all supporting resources for qualifying patients
  SELECT * FROM peptide_hits WHERE suspect_group IS NOT NULL
    AND PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)
  UNION ALL
  SELECT * FROM echo_hits
    WHERE PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)
  UNION ALL
  SELECT * FROM symptom_hits
    WHERE PATIENT_ID IN (SELECT PATIENT_ID FROM patients_with_all)
),

obs_with_fhir AS (
  -- Wrap each supporting resource in minimal FHIR
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType',  f.resource_type,
      'id',            f.resource_id,
      'status',        case when f.resource_type = 'Procedure' then 'completed' when f.resource_type = 'Condition' then null else 'final' end,
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
        IFF(TRY_TO_DOUBLE(f.RESULT) IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', TRY_TO_DOUBLE(f.RESULT),
              'unit',  f.units
            ),
            NULL),
      'valueString',
        IFF(TRY_TO_DOUBLE(f.RESULT) IS NULL, f.RESULT, NULL)
    ) AS fhir,
    f.resource_id,
    f.resource_type,
    f.DATA_SOURCE AS data_source
  FROM all_supporting f
)

SELECT
  PATIENT_ID,
  'hf_combined_suspect' AS suspect_group,
  'I50.9' AS suspect_icd10_code,
  'Heart failure, unspecified' AS suspect_icd10_short_description,
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
GROUP BY PATIENT_ID
ORDER BY PATIENT_ID;
