/* ============================================================
   Purpose
   -------
   Flag "depression_screen_positive" suspects from PHQ results 
   while EXCLUDING anyone already diagnosed with depressive disorders.

   Criteria (single-observation flags)
   -----------------------------------
   - PHQ-9 total (LOINC 44261-6): score >= 10  -> depression_phq9_10plus
   - PHQ-2 total (LOINC 55758-7): score >= 3   -> depression_phq2_3plus
     (PHQ-9 panel 44249-1 is a panel code; we rely on the total scores.)

   Exclusions
   ----------
   - Existing depression diagnosis in ICD-10-CM:
       * F32.*  (Major depressive disorder, single episode incl. F32.A)
       * F33.*  (Major depressive disorder, recurrent)
       * F34.1  (Dysthymia)

   Safety
   ------
   - TRY_TO_DOUBLE used to avoid errors on non-numeric RESULT.
   - Value guards keep scores within plausible PHQ ranges.
   - Embeds minimal FHIR in responsible_resources so the UI
     can render without a consolidated bundle.
   ============================================================ */

WITH depression_observations AS (
  SELECT
    /* Who the flag applies to */
    o.PATIENT_ID,

    /* Resource identity and type (UI expects capitalized FHIR type) */
    o.OBSERVATION_ID              AS resource_id,
    'Observation'                 AS resource_type,

    /* Assign screen-positive buckets based on PHQ totals */
    CASE
      WHEN o.NORMALIZED_CODE = '44261-6' AND TRY_TO_DOUBLE(o.RESULT) >= 10 THEN 'depression_phq9_10plus'
      WHEN o.NORMALIZED_CODE = '55758-7' AND TRY_TO_DOUBLE(o.RESULT) >= 3  THEN 'depression_phq2_3plus'
      ELSE NULL
    END AS suspect_group,

    /* Default suspect diagnosis label to review (not a diagnosis by itself) */
    'F32.A'  AS suspect_icd10_code,
    'Depression, unspecified (screen positive)' AS suspect_icd10_short_description,

    /* Fields to construct minimal FHIR */
    o.NORMALIZED_CODE_TYPE,
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.OBSERVATION_DATE,
    o.DATA_SOURCE

  FROM OBSERVATION o
  WHERE
    /* Only normalized PHQ totals available in your CSV */
    o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE IN ('44261-6','55758-7')      -- PHQ-9 total, PHQ-2 total

    /* Numeric guardrails within plausible PHQ ranges */
    AND (
      (o.NORMALIZED_CODE = '44261-6' AND TRY_TO_DOUBLE(o.RESULT) BETWEEN 0 AND 27)
      OR
      (o.NORMALIZED_CODE = '55758-7' AND TRY_TO_DOUBLE(o.RESULT) BETWEEN 0 AND 6)
    )

    /* Exclude patients already diagnosed with depressive disorders */
    AND NOT EXISTS (
      SELECT 1
      FROM CONDITION c
      WHERE c.PATIENT_ID = o.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND (
             c.NORMALIZED_CODE LIKE 'F32.%'   -- MDD, single episode (incl. F32.A)
          OR c.NORMALIZED_CODE LIKE 'F33.%'   -- MDD, recurrent
          OR c.NORMALIZED_CODE = 'F34.1'      -- Dysthymia
        )
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

      /* Status: not present in schema; default to 'final' */
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

      /* Value: scores are numeric; send as Quantity with unit 'score' */
      'valueQuantity',
        IFF(TRY_TO_DOUBLE(b.RESULT) IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', TRY_TO_DOUBLE(b.RESULT),
              'unit',  'score'
            ),
            NULL),

      /* Fallback string if somehow non-numeric slipped through guard */
      'valueString',
        IFF(TRY_TO_DOUBLE(b.RESULT) IS NULL, b.RESULT, NULL)
    ) AS fhir,

    b.resource_id,
    b.resource_type,
    b.DATA_SOURCE AS data_source
  FROM depression_observations b
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
      'data_source',   data_source,     -- from OBSERVATION.DATA_SOURCE (maps meta.source → data_source)
      'fhir',          fhir             -- minimal FHIR payload used by the UI
    )
  ) AS responsible_resources,

  CURRENT_TIMESTAMP() AS last_run

FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;