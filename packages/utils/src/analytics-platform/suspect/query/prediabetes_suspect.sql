/* ============================================================
   Purpose
   -------
   Flag "prediabetes suspects" from two sources:
     (A) Glucose (LOINC 2345-7) in OBSERVATION, normalized to mg/dL
         and bucketed by value ranges; and
     (B) HbA1c (LOINC 4548-4) in LAB_RESULT, using ONLY rows where
         SOURCE_UNITS = '%' (no normalization), bucketed by value range.
   Exclude patients already diagnosed with prediabetes (R73.03).

   Criteria / Thresholds (screening signals; single-observation)
   -------------------------------------------------------------
   - HbA1c 5.7–6.4%               -> prediabetes_hba1c
   - FPG 100–125 mg/dL            -> prediabetes_fpg
   - 2-hr OGTT 140–199 mg/dL      -> prediabetes_ogtt
     (If fasting vs. 2-hr isn’t distinguished for 2345-7, treat
      both ranges as screening signals to be clinically reviewed.)

   Safety / Implementation
   -----------------------
   - Uses TRY_TO_DOUBLE(...) to avoid errors on non-numeric RESULT.
   - Glucose unit handling remains (mmol/L → mg/dL via *18.0182).
   - HbA1c takes ONLY rows with SOURCE_UNITS = '%' and compares the
     numeric RESULT directly (no mmol/mol conversion).
   - Minimal FHIR Observation is embedded in responsible_resources
     so the UI can render without a separate bundle.
   ============================================================ */

WITH prediabetes_observations AS (
  /* Glucose (LOINC 2345-7) from OBSERVATION, normalized to mg/dL */
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID              AS resource_id,
    'Observation'                 AS resource_type,

    /* Normalize glucose to mg/dL for comparisons */
    CASE
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
        THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
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

    'R73.03'  AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,

    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.OBSERVATION_DATE AS OBS_DATE,
    o.RESULT,
    o.DATA_SOURCE
  FROM OBSERVATION o
  WHERE
    o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '2345-7'
    AND (
      CASE
        WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%mmol/L%'
          THEN TRY_TO_DOUBLE(o.RESULT) * 18.0182
        ELSE TRY_TO_DOUBLE(o.RESULT)
      END
    ) BETWEEN 100 AND 199
    AND NOT EXISTS (
      SELECT 1
      FROM CONDITION c
      WHERE c.PATIENT_ID = o.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND c.NORMALIZED_CODE = 'R73.03'
    )
),

prediabetes_labresults AS (
  /* HbA1c (LOINC 4548-4) from LAB_RESULT, ONLY SOURCE_UNITS = '%', no normalization */
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID            AS resource_id,
    'Observation'               AS resource_type,

    /* Direct numeric percent (no conversion) */
    TRY_TO_DOUBLE(lr.RESULT)    AS value_num,
    '%'                         AS value_unit,

    /* Bucket by HbA1c percent */
    CASE
      WHEN TRY_TO_DOUBLE(lr.RESULT) BETWEEN 5.7 AND 6.4 THEN 'prediabetes_hba1c'
      ELSE NULL
    END AS suspect_group,

    'R73.03'  AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description,

    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT_DATE AS OBS_DATE,
    lr.RESULT,
    lr.DATA_SOURCE
  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE = '4548-4'       -- HbA1c
    AND lr.SOURCE_UNITS = '%'               -- only percentages; no mmol/mol conversion
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM CONDITION c
      WHERE c.PATIENT_ID = lr.PATIENT_ID
        AND c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
        AND c.NORMALIZED_CODE = 'R73.03'
    )
),

/* Combine both sources into a single stream */
prediabetes_all AS (
  SELECT * FROM prediabetes_observations
  UNION ALL
  SELECT * FROM prediabetes_labresults
),

/* Build the minimal FHIR Observation JSON the UI reads */
obs_with_fhir AS (
  SELECT
    p.PATIENT_ID,
    p.suspect_group,
    p.suspect_icd10_code,
    p.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            p.resource_id,
      'status',        'final',
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
      'effectiveDateTime', TO_CHAR(p.OBS_DATE, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(p.value_num IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', p.value_num,
              'unit',  CASE WHEN p.suspect_group = 'prediabetes_hba1c' THEN '%' ELSE 'mg/dL' END
            ),
            NULL),
      'valueString',
        IFF(p.value_num IS NULL, p.RESULT, NULL)
    ) AS fhir,

    p.resource_id,
    p.resource_type,
    p.DATA_SOURCE AS data_source
  FROM prediabetes_all p
)

SELECT
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
  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
