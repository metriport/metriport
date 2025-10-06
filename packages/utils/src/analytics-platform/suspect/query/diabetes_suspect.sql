/* ============================================================
   Purpose
   -------
   Flag "diabetes suspects" from:
     (A) Glucose (LOINC 2345-7) in OBSERVATION, normalized to mg/dL, and
     (B) HbA1c (LOINC 4548-4) in LAB_RESULT, using ONLY rows where
         SOURCE_UNITS = '%' (no mmol/mol normalization),
   while EXCLUDING anyone already diagnosed with diabetes.

   Criteria (single-observation flags; screening signals)
   ------------------------------------------------------
   - Plasma/Serum Glucose (2345-7; mg/dL):
       * >= 200 mg/dL          -> diabetes_glucose_200plus
       * 126–199 mg/dL         -> diabetes_fpg_126_199  (assumes fasting if applicable)
   - HbA1c (4548-4; % only):
       * >= 6.5%               -> diabetes_hba1c_6p5plus

   Exclusions
   ----------
   - Existing diabetes diagnosis in ICD-10-CM E08–E13 (any subtype).

   Safety / Implementation
   -----------------------
   - TRY_TO_DOUBLE used to avoid errors on non-numeric RESULT.
   - Glucose values normalized to mg/dL when units indicate mmol/L.
   - HbA1c branch takes ONLY SOURCE_UNITS = '%' and compares value directly.
   - Minimal FHIR Observation is embedded so the UI can render without a bundle.
   ============================================================ */

WITH diabetes_observations AS (
  /* Glucose (LOINC 2345-7) from OBSERVATION, normalized to mg/dL */
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID              AS resource_id,
    'Observation'                 AS resource_type,

    /* Normalize glucose to mg/dL once, reuse below */
    CASE
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
        THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182        -- mmol/L -> mg/dL
      ELSE TRY_TO_DOUBLE(o.RESULT)
    END AS value_num,
    'mg/dL' AS value_unit,

    /* Bucket by normalized glucose value */
    CASE
      WHEN (
        CASE
          WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
            THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
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

    'E11.9'  AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,

    /* For FHIR rendering */
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.OBSERVATION_DATE AS OBS_DATE,
    o.RESULT,
    o.DATA_SOURCE
  FROM core_v2.CORE_V2__OBSERVATION o
  WHERE
    o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '2345-7'                -- Glucose [Mass/volume] in Serum/Plasma
    AND (
      CASE
        WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
          THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
        ELSE TRY_TO_DOUBLE(o.RESULT)
      END
    ) >= 126
    AND NOT EXISTS (
      SELECT 1
      FROM core_v2.CORE_V2__CONDITION c 
      WHERE c.PATIENT_ID = o.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND LEFT(c.NORMALIZED_CODE, 3) IN ('E08','E09','E10','E11','E13')
    )
),

diabetes_labresults AS (
  /* HbA1c (LOINC 4548-4) from LAB_RESULT, ONLY SOURCE_UNITS='%' (no normalization) */
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID             AS resource_id,
    'Observation'                AS resource_type,

    TRY_TO_DOUBLE(lr.RESULT)     AS value_num,
    '%'                          AS value_unit,

    CASE
      WHEN TRY_TO_DOUBLE(lr.RESULT) >= 6.5 THEN 'diabetes_hba1c_6p5plus'
      ELSE NULL
    END AS suspect_group,

    'E11.9'  AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,

    /* For FHIR rendering */
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT_DATE               AS OBS_DATE,
    lr.RESULT,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '4548-4'   -- HbA1c
    AND lr.SOURCE_UNITS = '%'           -- % only
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM core_v2.CORE_V2__CONDITION c 
      WHERE c.PATIENT_ID = lr.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND LEFT(c.NORMALIZED_CODE, 3) IN ('E08','E09','E10','E11','E13')
    )
),

/* Combine both sources into a single stream */
diabetes_all AS (
  SELECT * FROM diabetes_observations
  UNION ALL
  SELECT * FROM diabetes_labresults
),

/* Build the minimal FHIR Observation JSON the UI reads */
obs_with_fhir AS (
  SELECT
    d.PATIENT_ID,
    d.suspect_group,
    d.suspect_icd10_code,
    d.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            d.resource_id,
      'status',        'final',
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
      'effectiveDateTime', TO_CHAR(d.OBS_DATE, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(d.value_num IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', d.value_num,
              'unit',  d.value_unit
            ),
            NULL),
      'valueString',
        IFF(d.value_num IS NULL, d.RESULT, NULL)
    ) AS fhir,

    d.resource_id,
    d.resource_type,
    d.DATA_SOURCE AS data_source
  FROM diabetes_all d
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
      'resource_type', resource_type,
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,

  /* Run timestamp for lineage */
  CURRENT_TIMESTAMP() AS last_run

FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
