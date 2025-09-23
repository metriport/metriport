/* ============================================================
   Purpose
   -------
   Flag "morbid_obesity" suspects when:
     (A) Direct BMI (LOINC 39156-5) >= 40, OR
     (B) Derived BMI from weight (29463-7) and height (8302-2) >= 40,
   while EXCLUDING patients who already have an obesity diagnosis.

   Exclusions
   ----------
   - Patients with ICD-10-CM in ('E66.01','E66.2','E66.813')

   Notes
   -----
   - Weight normalized to kg; height normalized to meters.
   - Weight and height used for derived BMI are taken from the
     SAME ENCOUNTER_ID (contemporaneous) and we pick the LATEST
     such encounter per patient.
   - TRY_TO_DOUBLE used to avoid errors on non-numeric RESULT.
   - Embeds minimal FHIR in responsible_resources so the UI
     can render without a consolidated bundle.
   ============================================================ */

WITH obesity_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE.CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE IN ('E66.01','E66.2','E66.813')
),

/* ------------------------------------------------------------
   (A) Direct BMI path (LOINC 39156-5). Flags if BMI >= 40.
   ------------------------------------------------------------ */
bmi_direct AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                  AS resource_id,
    'Observation'                                     AS resource_type,
    /* suspect bucket */
    'morbid_obesity'                                  AS suspect_group,
    /* suspect diagnosis label (for review; not a diagnosis itself) */
    'E66.01'                                          AS suspect_icd10_code,
    'Morbid (severe) obesity due to excess calories'  AS suspect_icd10_short_description,

    /* fields to build FHIR */
    o.NORMALIZED_CODE,
    o.NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.OBSERVATION_DATE,
    o.DATA_SOURCE

  FROM CORE.OBSERVATION o
  WHERE o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '39156-5'                    -- BMI
    AND TRY_TO_DOUBLE(o.RESULT) >= 40
    AND NOT EXISTS (SELECT 1 FROM obesity_dx_exclusion x WHERE x.PATIENT_ID = o.PATIENT_ID)
),

/* ------------------------------------------------------------
   Helpers: Weight and Height normalization
   ------------------------------------------------------------ */

/* Weight (29463-7) normalized to kilograms. */
weights AS (
  SELECT
    o.PATIENT_ID,
    o.ENCOUNTER_ID,
    o.OBSERVATION_ID,
    o.OBSERVATION_DATE,
    COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) AS units,
    o.DATA_SOURCE,
    CASE
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%kg%'
        THEN TRY_TO_DOUBLE(o.RESULT)
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%lb%'
        THEN TRY_TO_DOUBLE(o.RESULT) * 0.45359237
      /* Heuristics if units are missing: */
      WHEN TRY_TO_DOUBLE(o.RESULT) BETWEEN 30 AND 500
        THEN TRY_TO_DOUBLE(o.RESULT)                       -- plausible kg
      WHEN TRY_TO_DOUBLE(o.RESULT) BETWEEN 70 AND 1100
        THEN TRY_TO_DOUBLE(o.RESULT) * 0.45359237          -- plausible lb
      ELSE NULL
    END AS weight_kg
  FROM CORE.OBSERVATION o
  WHERE o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '29463-7'           -- Body weight
),

/* Height (8302-2) normalized to meters. */
heights AS (
  SELECT
    o.PATIENT_ID,
    o.ENCOUNTER_ID,
    o.OBSERVATION_ID,
    o.OBSERVATION_DATE,
    COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) AS units,
    o.DATA_SOURCE,
    CASE
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%m%'
           AND COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) NOT ILIKE '%cm%'
        THEN TRY_TO_DOUBLE(o.RESULT)                      -- meters
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%cm%'
        THEN TRY_TO_DOUBLE(o.RESULT) / 100                -- centimeters -> meters
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%in%'
        THEN TRY_TO_DOUBLE(o.RESULT) * 0.0254             -- inches -> meters
      WHEN COALESCE(NULLIF(o.NORMALIZED_UNITS,''), o.SOURCE_UNITS) ILIKE '%ft%'
        THEN TRY_TO_DOUBLE(o.RESULT) * 0.3048             -- feet -> meters
      /* Heuristics if units are missing: */
      WHEN TRY_TO_DOUBLE(o.RESULT) BETWEEN 1 AND 2.5
        THEN TRY_TO_DOUBLE(o.RESULT)                      -- meters
      WHEN TRY_TO_DOUBLE(o.RESULT) BETWEEN 120 AND 250
        THEN TRY_TO_DOUBLE(o.RESULT) / 100                -- centimeters -> meters
      WHEN TRY_TO_DOUBLE(o.RESULT) BETWEEN 48 AND 100
        THEN TRY_TO_DOUBLE(o.RESULT) * 0.0254             -- inches -> meters
      ELSE NULL
    END AS height_m
  FROM CORE.OBSERVATION o
  WHERE o.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND o.NORMALIZED_CODE = '8302-2'           -- Body height
),

/* Latest weight per patient+encounter. */
latest_weight_per_enc AS (
  SELECT *
  FROM weights
  WHERE weight_kg IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PATIENT_ID, ENCOUNTER_ID
    ORDER BY OBSERVATION_DATE DESC, OBSERVATION_ID DESC
  ) = 1
),

/* Latest height per patient+encounter. */
latest_height_per_enc AS (
  SELECT *
  FROM heights
  WHERE height_m IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PATIENT_ID, ENCOUNTER_ID
    ORDER BY OBSERVATION_DATE DESC, OBSERVATION_ID DESC
  ) = 1
),

/* Encounters with BOTH weight and height; pick latest such encounter per patient. */
latest_encounter_pair AS (
  SELECT
    w.PATIENT_ID,
    w.ENCOUNTER_ID,
    w.OBSERVATION_ID AS weight_obs_id,
    h.OBSERVATION_ID AS height_obs_id,
    w.DATA_SOURCE    AS weight_data_source,
    h.DATA_SOURCE    AS height_data_source,
    w.weight_kg,
    h.height_m,
    GREATEST(w.OBSERVATION_DATE, h.OBSERVATION_DATE) AS pair_observation_date
  FROM latest_weight_per_enc w
  JOIN latest_height_per_enc h
    ON h.PATIENT_ID  = w.PATIENT_ID
   AND h.ENCOUNTER_ID = w.ENCOUNTER_ID
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY w.PATIENT_ID
    ORDER BY pair_observation_date DESC, weight_obs_id DESC, height_obs_id DESC
  ) = 1
),

/* ------------------------------------------------------------
   (B) Derived BMI from the latest same-encounter W+H pair.
   ------------------------------------------------------------ */
bmi_derived AS (
  SELECT
    p.PATIENT_ID,
    /* Use weight observation id as the resource identity */
    p.weight_obs_id                                 AS resource_id,
    'Observation'                                   AS resource_type,
    /* suspect bucket */
    CASE WHEN (p.weight_kg / NULLIF(p.height_m * p.height_m, 0)) >= 40
         THEN 'morbid_obesity_derived' ELSE NULL END AS suspect_group,
    'E66.01'                                        AS suspect_icd10_code,
    'Morbid (severe) obesity due to excess calories' AS suspect_icd10_short_description,

    /* fields to build FHIR */
    '39156-5'                                       AS NORMALIZED_CODE,          -- BMI
    'Body mass index (BMI)'                         AS NORMALIZED_DESCRIPTION,
    /* RESULT as string for uniform downstream handling */
    TO_VARCHAR(p.weight_kg / NULLIF(p.height_m * p.height_m, 0)) AS RESULT,
    p.pair_observation_date                         AS OBSERVATION_DATE,
    /* Prefer weight data source; fall back to height */
    COALESCE(p.weight_data_source, p.height_data_source) AS DATA_SOURCE

  FROM latest_encounter_pair p
  WHERE (p.weight_kg / NULLIF(p.height_m * p.height_m, 0)) >= 40
    AND NOT EXISTS (SELECT 1 FROM obesity_dx_exclusion x WHERE x.PATIENT_ID = p.PATIENT_ID)
),

/* Union direct and derived BMI flags with a consistent shape. */
all_obesity_flags AS (
  SELECT * FROM bmi_direct
  UNION ALL
  SELECT * FROM bmi_derived
),

/* Build minimal FHIR Observation JSON for each supporting resource. */
obs_with_fhir AS (
  SELECT
    f.PATIENT_ID,
    f.suspect_group,
    f.suspect_icd10_code,
    f.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            f.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(f.NORMALIZED_DESCRIPTION, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     f.NORMALIZED_CODE,
            'display',  f.NORMALIZED_DESCRIPTION
          )
        )
      ),
      /* Date → FHIR date string */
      'effectiveDateTime', TO_CHAR(f.OBSERVATION_DATE, 'YYYY-MM-DD'),
      /* Value: BMI numeric as Quantity (kg/m2); fallback string if needed */
      'valueQuantity',
        IFF(TRY_TO_DOUBLE(f.RESULT) IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', TRY_TO_DOUBLE(f.RESULT),
              'unit',  'kg/m2'
            ),
            NULL),
      'valueString',
        IFF(TRY_TO_DOUBLE(f.RESULT) IS NULL, f.RESULT, NULL)
    ) AS fhir,

    f.resource_id,
    f.resource_type,
    f.DATA_SOURCE AS data_source
  FROM all_obesity_flags f
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  /* Enriched responsible_resources for the UI */
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,   -- "Observation"
      'data_source',   data_source,     -- from OBSERVATION.DATA_SOURCE or derived pair
      'fhir',          fhir             -- minimal FHIR payload
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
WHERE suspect_group IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
