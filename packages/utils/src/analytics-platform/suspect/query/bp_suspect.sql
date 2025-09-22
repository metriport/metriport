/* ============================================================
   Purpose: Flag patients as "hypertension suspects" from
            discrete BP observations (LOINC):
              - 8480-6: Systolic blood pressure
              - 8462-4: Diastolic blood pressure
            while excluding anyone already diagnosed with HTN.
   Staging thresholds used (single-observation labeling):
     - Stage 2 HTN: SBP ≥ 140  OR  DBP ≥ 90
     - Stage 1 HTN: SBP 130–139 OR DBP 80–89
   Notes:
     - Uses TRY_CAST(...) to avoid errors on non-numeric RESULT.
     - CASE is ordered so Stage 2 matches take precedence over Stage 1.
     - This flags by individual observations; it is not a clinical diagnosis.
   ============================================================ */

WITH bp_observations AS (
  SELECT
    /* Who the flag applies to */
    o.PATIENT_ID,

    /* Resource identity and type (UI expects capitalized FHIR type) */
    o.OBSERVATION_ID              AS resource_id,
    'Observation'                 AS resource_type,

    /* Suspect grouping (stage precedence: stage2 > stage1) */
    CASE
      WHEN o.NORMALIZED_CODE = '8480-6' AND TRY_TO_DOUBLE(o.RESULT) >= 140 THEN 'stage2_systolic'
      WHEN o.NORMALIZED_CODE = '8462-4' AND TRY_TO_DOUBLE(o.RESULT) >= 90  THEN 'stage2_diastolic'
      WHEN o.NORMALIZED_CODE = '8480-6' AND TRY_TO_DOUBLE(o.RESULT) BETWEEN 130 AND 139 THEN 'stage1_systolic'
      WHEN o.NORMALIZED_CODE = '8462-4' AND TRY_TO_DOUBLE(o.RESULT) BETWEEN 80  AND 89  THEN 'stage1_diastolic'
      ELSE NULL
    END AS suspect_group,

    /* Target ICD-10 & label for HTN */
    'I10'   AS suspect_icd10_code,
    'Essential (primary) hypertension' AS suspect_icd10_short_description,

    /* Fields to construct minimal FHIR */
    o.NORMALIZED_CODE_TYPE,
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.RESULT,
    /* Prefer NORMALIZED_UNITS if present, else SOURCE_UNITS */
    COALESCE(NULLIF(o.NORMALIZED_UNITS, ''), o.SOURCE_UNITS) AS units,
    o.OBSERVATION_DATE,
    o.DATA_SOURCE

  FROM OBSERVATION o
  WHERE
    /* Only normalized LOINC BP observations */
    o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE IN ('8480-6','8462-4')

    /* Ignore clearly non-hypertensive / non-numeric */
    AND TRY_TO_DOUBLE(o.RESULT) >= 80

    AND NOT EXISTS (
      SELECT 1
      FROM CONDITION c
      WHERE c.PATIENT_ID = o.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND LEFT(c.NORMALIZED_CODE,3) IN ('I10','I11','I12','I13','I15')
    )
),

/* Build the minimal FHIR Observation JSON the UI actually reads */
obs_with_fhir AS (
  SELECT
    b.PATIENT_ID,
    b.suspect_group,
    b.suspect_icd10_code,
    b.suspect_icd10_short_description,

    /* Minimal FHIR Observation payload */
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            b.resource_id,

      /* Status: not provided in schema; default to 'final' */
      'status',        'final',

      /* CodeableConcept with LOINC */
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(b.NORMALIZED_DESCRIPTION, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     b.NORMALIZED_CODE,
            'display',  b.NORMALIZED_DESCRIPTION
          )
        )
      ),

      /* effective[x]: we have a DATE → valid FHIR date string */
      'effectiveDateTime', TO_CHAR(b.OBSERVATION_DATE, 'YYYY-MM-DD'),

      /* Value: Quantity if numeric, else String */
      'valueQuantity',
        IFF(TRY_TO_DOUBLE(b.RESULT) IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', TRY_TO_DOUBLE(b.RESULT),
              'unit',  b.units
            ),
            NULL),

      'valueString',
        IFF(TRY_TO_DOUBLE(b.RESULT) IS NULL, b.RESULT, NULL)
    ) AS fhir,

    b.resource_id,
    b.resource_type,
    b.DATA_SOURCE AS data_source
  FROM bp_observations b
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  /* Enriched responsible_resources object array for the UI */
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,   -- "Observation"
      'data_source',   data_source,     -- from OBSERVATION.DATA_SOURCE
      'fhir',          fhir             -- minimal FHIR payload
    )
  ) AS responsible_resources,

  CURRENT_TIMESTAMP() AS last_run

FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
