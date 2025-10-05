/* ============================================================
   BIPOLAR DISORDER — SUSPECT QUERY (Lithium only)
   ------------------------------------------------------------
   Purpose
     Flag "bipolar_disorder suspects" if patient has Lithium
     (LOINC 14334-7) lab results in LAB_RESULT.
     This is a *screening signal* only, not a diagnosis.

   Exclusions
     • Existing bipolar diagnosis: ICD-10 F31.*
     • Substance/medication-induced mood disorder: 
       ICD-10 F10.14, F15.24, F19.14

   Output
     • One row per patient
     • Minimal FHIR Observation for UI rendering
   ============================================================ */

WITH bipolar_dx_exclusion AS (
  -- Patients already diagnosed with Bipolar Disorder
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'F31.%'
),

substance_induced_exclusion AS (
  -- Patients with substance/medication-induced mood disorder
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE IN ('F10.14','F15.24','F19.14')
),

lithium_hits AS (
  -- Lithium lab results
  SELECT
    lr.PATIENT_ID,
    'bipolar_lithium_signal' AS suspect_group,
    'F31.9' AS suspect_icd10_code,
    'Bipolar disorder, unspecified (screen signal)' AS suspect_icd10_short_description,

    lr.LAB_RESULT_ID AS resource_id,
    'Observation'    AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,
    CAST(lr.RESULT_DATE AS DATE) AS obs_date,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '14334-7'  -- Lithium, serum level
    AND NOT EXISTS (SELECT 1 FROM bipolar_dx_exclusion x WHERE x.PATIENT_ID = lr.PATIENT_ID)
    AND NOT EXISTS (SELECT 1 FROM substance_induced_exclusion y WHERE y.PATIENT_ID = lr.PATIENT_ID)
),

lithium_with_fhir AS (
  -- Wrap in minimal FHIR Observation
  SELECT
    l.PATIENT_ID,
    l.suspect_group,
    l.suspect_icd10_code,
    l.suspect_icd10_short_description,
    l.resource_id,
    l.resource_type,
    l.NORMALIZED_CODE,
    l.NORMALIZED_DESCRIPTION,
    l.RESULT,
    l.units,
    l.obs_date,
    l.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            l.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(l.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     l.NORMALIZED_CODE,
            'display',  l.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(l.obs_date, 'YYYY-MM-DD'),
      'valueString', IFF(TRY_TO_DOUBLE(l.RESULT) IS NULL, l.RESULT, NULL),
      'valueQuantity', IFF(TRY_TO_DOUBLE(l.RESULT) IS NOT NULL,
        OBJECT_CONSTRUCT('value', TRY_TO_DOUBLE(l.RESULT), 'unit', l.units),
        NULL
      )
    ) AS fhir
  FROM lithium_hits l
)

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
FROM lithium_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
