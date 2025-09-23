/* ============================================================
   Purpose
   -------
   Flag "diabetes suspects" from lab observations using LOINC
   codes present (plasma/serum glucose 2345-7),
   while EXCLUDING anyone already diagnosed with diabetes.

   Criteria (single-observation flags)
   -----------------------------------
   - Plasma/Serum Glucose (LOINC 2345-7):
       * >= 200 mg/dL         -> diabetes_glucose_200plus
       * 126–199 mg/dL        -> diabetes_fpg_126_199  (assumes fasting)
     Note: Without a fasting/OGTT indicator, we label by value range only.

   Exclusions
   ----------
   - Existing diabetes diagnosis in ICD-10-CM E08–E13 (any subtype).

   Safety
   ------
   - TRY_TO_DOUBLE is used to avoid errors on non-numeric RESULT.
   - Glucose values are normalized to mg/dL for comparisons and display.
   - Embeds minimal FHIR in responsible_resources so the UI
     can render without a consolidated bundle.
   ============================================================ */

WITH diabetes_observations AS (
  SELECT
    /* Who the flag applies to */
    o.PATIENT_ID,

    /* Resource metadata for traceability/audit (UI expects capitalized FHIR type) */
    o.OBSERVATION_ID              AS resource_id,
    'Observation'                 AS resource_type,

    /* Normalize glucose to mg/dL for comparisons, then bucket */
    CASE
      WHEN (
        CASE
          WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
            THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182        -- mmol/L -> mg/dL
          ELSE TRY_TO_DOUBLE(o.RESULT)
        END
      ) >= 200 THEN 'diabetes_glucose_200plus'
      WHEN (
        CASE
          WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
            THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
          ELSE TRY_TO_DOUBLE(o.RESULT)
        END
      ) BETWEEN 126 AND 199 THEN 'diabetes_fpg_126_199'
      ELSE NULL
    END AS suspect_group,

    /* Default suspect diagnosis label */
    'E11.9'  AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,

    /* Fields to construct minimal FHIR */
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.OBSERVATION_DATE,
    o.RESULT,
    COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) AS units,
    o.DATA_SOURCE
  FROM OBSERVATION o
  WHERE
    /* Only normalized LOINC plasma/serum glucose */
    o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '2345-7'                -- Glucose [Mass/volume] in Serum/Plasma

    /* Numeric guardrail in mg/dL */
    AND (
      CASE
        WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
          THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
        ELSE TRY_TO_DOUBLE(o.RESULT)
      END
    ) >= 126

    /* Exclude patients already diagnosed with diabetes (any E08–E13) */
    AND NOT EXISTS (
      SELECT 1
      FROM CONDITION c
      WHERE c.PATIENT_ID = o.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND LEFT(c.NORMALIZED_CODE, 3) IN ('E08','E09','E10','E11','E13')
    )
),

/* Build the minimal FHIR Observation JSON the UI actually reads */
obs_with_fhir AS (
  SELECT
    d.PATIENT_ID,
    d.suspect_group,
    d.suspect_icd10_code,
    d.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            d.resource_id,

      /* Status not present in schema; default to 'final' */
      'status',        'final',

      /* CodeableConcept for LOINC 2345-7 */
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(d.NORMALIZED_DESCRIPTION, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     d.NORMALIZED_CODE,
            'display',  d.NORMALIZED_DESCRIPTION
          )
        )
      ),

      /* effective[x]: we have only a DATE → FHIR date string */
      'effectiveDateTime', TO_CHAR(d.OBSERVATION_DATE, 'YYYY-MM-DD'),

      /* Value: emit mg/dL after normalization for display */
      'valueQuantity',
        IFF(TRY_TO_DOUBLE(d.RESULT) IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value',
                CASE
                  WHEN COALESCE(NULLIF(d.units,''), 'mg/dL') ILIKE '%mmol/L%'
                    THEN TRY_TO_DOUBLE(d.RESULT) * 18.0182
                  ELSE TRY_TO_DOUBLE(d.RESULT)
                END,
              'unit',  'mg/dL'
            ),
            NULL),
      'valueString',
        IFF(TRY_TO_DOUBLE(d.RESULT) IS NULL, d.RESULT, NULL)
    ) AS fhir,

    d.resource_id,
    d.resource_type,
    d.DATA_SOURCE AS data_source
  FROM diabetes_observations d
)

SELECT
  /* Final grouping per patient and bucket */
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  /* Enriched supporting resources for the UI */
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,   -- "Observation"
      'data_source',   data_source,     -- from OBSERVATION.DATA_SOURCE
      'fhir',          fhir             -- minimal FHIR payload
    )
  ) AS responsible_resources,

  /* Run timestamp for lineage */
  CURRENT_TIMESTAMP() AS last_run

FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
