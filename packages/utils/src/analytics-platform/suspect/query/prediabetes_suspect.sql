/* ============================================================
   Purpose: Flag patients as "prediabetes suspects" based on
            glucose results (LOINC 2345-7: Serum/Plasma Glucose),
            while excluding anyone already diagnosed with R73.03.

   Criteria / Thresholds (single-observation flags; screening only)
   ----------------------------------------------------------------
   - FPG 100–125 mg/dL  -> prediabetes_fpg
   - 2-hr OGTT 140–199  -> prediabetes_ogtt
     (If the feed doesn’t distinguish fasting vs 2-hr for 2345-7,
      these are screening signals, not diagnoses.)

   Safety / Implementation
   -----------------------
   - Uses TRY_TO_DOUBLE(...) to avoid errors on non-numeric RESULT.
   - Glucose is normalized to mg/dL for comparisons and display:
       mg/dL = mmol/L * 18.0182 when units indicate mmol/L.
   - Embeds minimal FHIR in responsible_resources so the UI
     can render without a consolidated bundle.
   ============================================================ */

WITH prediabetes_observations AS (
  SELECT
    /* Who the flag applies to */
    o.PATIENT_ID,

    /* Resource metadata we’ll return for traceability (UI expects capitalized FHIR type) */
    o.OBSERVATION_ID              AS resource_id,
    'Observation'                 AS resource_type,

    /* Normalize glucose to mg/dL for comparisons, then bucket */
    CASE
      WHEN (
        CASE
          WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
            THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
          ELSE TRY_TO_DOUBLE(o.RESULT)
        END
      ) BETWEEN 100 AND 125 THEN 'prediabetes_fpg'
      WHEN (
        CASE
          WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
            THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
          ELSE TRY_TO_DOUBLE(o.RESULT)
        END
      ) BETWEEN 140 AND 199 THEN 'prediabetes_ogtt'
      ELSE NULL
    END AS suspect_group,

    /* Target ICD-10 (prediabetes) and short description */
    'R73.03'  AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,

    /* Fields to construct minimal FHIR */
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.OBSERVATION_DATE,
    o.RESULT,
    COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) AS units,
    o.DATA_SOURCE
  FROM OBSERVATION o
  WHERE
    /* Only normalized LOINC glucose in serum/plasma */
    o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '2345-7'

    /* Numeric guardrail in mg/dL */
    AND (
      CASE
        WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
          THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
        ELSE TRY_TO_DOUBLE(o.RESULT)
      END
    ) BETWEEN 100 AND 199

    /* Exclude patients already diagnosed with prediabetes */
    AND NOT EXISTS (
      SELECT 1
      FROM CONDITION c
      WHERE c.PATIENT_ID = o.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND c.NORMALIZED_CODE = 'R73.03'
    )
),

/* Build the minimal FHIR Observation JSON the UI actually reads */
obs_with_fhir AS (
  SELECT
    p.PATIENT_ID,
    p.suspect_group,
    p.suspect_icd10_code,
    p.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            p.resource_id,

      /* Status not present in schema; default to 'final' */
      'status',        'final',

      /* CodeableConcept for LOINC 2345-7 */
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(p.NORMALIZED_DESCRIPTION, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     p.NORMALIZED_CODE,
            'display',  p.NORMALIZED_DESCRIPTION
          )
        )
      ),

      /* effective[x]: we have only a DATE → FHIR date string */
      'effectiveDateTime', TO_CHAR(p.OBSERVATION_DATE, 'YYYY-MM-DD'),

      /* Value: emit mg/dL after normalization for display; fallback string if non-numeric */
      'valueQuantity',
        IFF(TRY_TO_DOUBLE(p.RESULT) IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value',
                CASE
                  WHEN COALESCE(NULLIF(p.units,''), 'mg/dL') ILIKE '%mmol/L%'
                    THEN TRY_TO_DOUBLE(p.RESULT) * 18.0182
                  ELSE TRY_TO_DOUBLE(p.RESULT)
                END,
              'unit',  'mg/dL'
            ),
            NULL),
      'valueString',
        IFF(TRY_TO_DOUBLE(p.RESULT) IS NULL, p.RESULT, NULL)
    ) AS fhir,

    p.resource_id,
    p.resource_type,
    p.DATA_SOURCE AS data_source
  FROM prediabetes_observations p
)

SELECT
  /* Final grouping dimensions per patient and bucket */
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

  /* Stamp when this query was run */
  CURRENT_TIMESTAMP() AS last_run

FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
