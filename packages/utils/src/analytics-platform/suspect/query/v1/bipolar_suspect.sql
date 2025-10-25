/* ============================================================
   BIPOLAR DISORDER — SUSPECT QUERY (Lithium only)
   ------------------------------------------------------------
   Purpose
     Flag "bipolar_disorder suspects" if patient has Lithium
     (LOINC 14334-7) lab results in OBSERVATION.
     This is a *screening signal* only, not a diagnosis.

   Exclusions
     • Existing bipolar diagnosis: ICD-10 F31.*
     • Substance/medication-induced mood disorder:
       ICD-10 F10.14, F15.24, F19.14  (accept dotted or undotted)

   Output
     • One row per patient
     • Minimal FHIR Observation for UI rendering
   ============================================================ */

WITH bipolar_dx_exclusion AS (
  /* Patients already diagnosed with Bipolar Disorder */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'F31%'
),

substance_induced_exclusion AS (
  /* Patients with substance/medication-induced mood disorder
     (handle both dotted and undotted representations) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE c.ICD_10_CM_CODE IN ('F1014','F1524','F1914')

),

/* -------------------------
   RAW
   ------------------------- */
lithium_raw AS (
  /* Lithium result: extract numeric token, require non-empty units, token > 0 */
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                 AS resource_id,
    'Observation'                                                    AS resource_type,
    o.LOINC_CODE                                                     AS NORMALIZED_CODE,
    o.LOINC_DISPLAY                                                  AS NORMALIZED_DESCRIPTION,
    o.VALUE                                                          AS RESULT,
    o.UNITS                                                          AS units,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                       AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE o.LOINC_CODE = '14334-7'  -- Lithium [Moles/volume] in Serum or Plasma
    /* ensure numeric token exists */
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    /* ensure units aren't null or empty */
    AND NULLIF(o.UNITS,'') IS NOT NULL
    /* ensure numeric token > 0 */
    AND TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) > 0
),

/* -------------------------
   NORM (display units → mmol/L if matched)
   ------------------------- */
lithium_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units ILIKE '%mmol/l%' THEN 'mmol/L'
      ELSE r.units
    END AS units_disp
  FROM lithium_raw r
),

/* -------------------------
   CLEAN (apply exclusions and only return mmol/L; plausibility upper bound 4)
   ------------------------- */
lithium_clean AS (
  SELECT *
  FROM lithium_norm n
  WHERE n.units_disp = 'mmol/L'
    AND TRY_TO_DOUBLE(n.value_token) <= 4
    AND NOT EXISTS (SELECT 1 FROM bipolar_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
    AND NOT EXISTS (SELECT 1 FROM substance_induced_exclusion y WHERE y.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT (separate from CLEAN)
   ------------------------- */
lithium_suspects AS (
  SELECT
    e.PATIENT_ID,
    'bipolar_lithium_signal'                         AS suspect_group,
    'F31.9'                                          AS suspect_icd10_code,
    'Bipolar disorder, unspecified (screen signal)'  AS suspect_icd10_short_description,
    e.resource_id,
    e.resource_type,
    e.NORMALIZED_CODE,
    e.NORMALIZED_DESCRIPTION,
    e.RESULT,
    e.units,
    e.value_token,
    e.obs_date,
    e.DATA_SOURCE
  FROM lithium_clean e
),

/* -------------------------
   FHIR wrapper
   ------------------------- */
lithium_with_fhir AS (
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
      /* Show original RESULT only if not parseable numeric */
      'valueString', IFF(TRY_TO_DOUBLE(l.RESULT) IS NULL, l.RESULT, NULL),
      /* Use verified numeric token in valueQuantity */
      'valueQuantity', IFF(TRY_TO_DOUBLE(l.value_token) IS NOT NULL,
        OBJECT_CONSTRUCT('value', TRY_TO_DOUBLE(l.value_token), 'unit', l.units),
        NULL
      )
    ) AS fhir
  FROM lithium_suspects l
)

/* -------------------------
   RETURN (one row per patient)
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
FROM lithium_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
