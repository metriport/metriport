/* ============================================================
   CAD SUSPECT QUERY — Troponin + Prior Revascularization Only
   ------------------------------------------------------------
   Purpose
     • Flag CAD suspects using:
         (A) Troponin above conservative cutoffs (normalized to ng/L)
             - Troponin I (10839-9)  ≥ 40 ng/L
             - Troponin T (6598-7)  ≥ 14 ng/L
         (B) Prior revascularization procedures:
             - PCI stent (CPT 92928, 92929)
             - CABG (CPT 33511, 33512)
     • Exclude patients already diagnosed with CAD (ICD-10 I25.*).

   Notes
     • Ignores troponin rows where units are empty/missing.
     • Emits minimal FHIR for UI: Observation for labs, Procedure for procedures.
   ============================================================ */

WITH cad_dx_exclusion AS (
  -- Exclude patients with existing CAD diagnosis
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I25%'
),

/* ------------------------------------------------------------
   (A) Troponin path — normalize all values to ng/L, apply cutoffs
   ------------------------------------------------------------ */
troponin_hits AS (
  SELECT
    lr.PATIENT_ID,
    /* Suspect bucket based on test type crossing the cutoff */
    CASE
      WHEN lr.NORMALIZED_CODE = '10839-9' THEN 'cad_troponin_i_high'
      WHEN lr.NORMALIZED_CODE = '6598-7'  THEN 'cad_troponin_t_high'
      ELSE NULL
    END AS suspect_group,
    'I25.10' AS suspect_icd10_code,
    'Atherosclerotic heart disease of native coronary artery without angina pectoris'
      AS suspect_icd10_short_description,

    lr.LAB_RESULT_ID AS resource_id,
    'Observation'    AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    /* Keep original units for display; also enforce non-empty */
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) AS units,

    /* Normalized numeric value in ng/L (used for thresholding & FHIR valueQuantity) */
    CASE
      WHEN lr.NORMALIZED_CODE IN ('10839-9','6598-7') THEN
        CASE
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ng/ml%'
            THEN TRY_TO_DOUBLE(lr.RESULT) * 1000          -- ng/mL -> ng/L
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ug/l%'
            THEN TRY_TO_DOUBLE(lr.RESULT) * 1000          -- µg/L  -> ng/L
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%pg/ml%'
            THEN TRY_TO_DOUBLE(lr.RESULT)                  -- pg/mL ≈ ng/L
          WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ng/l%'
            THEN TRY_TO_DOUBLE(lr.RESULT)                  -- already ng/L
          ELSE NULL
        END
      ELSE NULL
    END AS value_num, -- ng/L

    CAST(lr.RESULT_DATE AS DATE) AS obs_date,
    lr.DATA_SOURCE

  FROM LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN ('10839-9','6598-7')        -- cTnI, cTnT
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) IS NOT NULL
    AND TRY_TO_DOUBLE(lr.RESULT) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM cad_dx_exclusion x WHERE x.PATIENT_ID = lr.PATIENT_ID)
    -- Apply conservative cutoffs in ng/L
    AND (
      (lr.NORMALIZED_CODE = '10839-9' AND
         CASE
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(lr.RESULT) * 1000
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(lr.RESULT) * 1000
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(lr.RESULT)
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(lr.RESULT)
           ELSE NULL
         END >= 40
      )
      OR
      (lr.NORMALIZED_CODE = '6598-7' AND
         CASE
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ng/ml%' THEN TRY_TO_DOUBLE(lr.RESULT) * 1000
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ug/l%'  THEN TRY_TO_DOUBLE(lr.RESULT) * 1000
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%pg/ml%' THEN TRY_TO_DOUBLE(lr.RESULT)
           WHEN COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), lr.SOURCE_UNITS) ILIKE '%ng/l%'  THEN TRY_TO_DOUBLE(lr.RESULT)
           ELSE NULL
         END >= 14
      )
    )
),

/* ------------------------------------------------------------
   (B) Revascularization evidence — PCI/CABG procedures only
   ------------------------------------------------------------ */
revasc_hits AS (
  SELECT
    p.PATIENT_ID,
    CASE
      WHEN p.NORMALIZED_CODE IN ('92928','92929') THEN 'cad_prior_pci'
      WHEN p.NORMALIZED_CODE IN ('33511','33512') THEN 'cad_prior_cabg'
      ELSE NULL
    END AS suspect_group,
    'I25.10' AS suspect_icd10_code,
    'Atherosclerotic heart disease of native coronary artery without angina pectoris'
      AS suspect_icd10_short_description,

    p.PROCEDURE_ID AS resource_id,
    'Procedure'    AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    /* Procedures have no RESULT/units/value_num */
    NULL AS RESULT,
    NULL AS units,
    NULL AS value_num,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM PROCEDURE p
  WHERE p.NORMALIZED_CODE IN ('92928','92929','33511','33512')
    AND NOT EXISTS (SELECT 1 FROM cad_dx_exclusion x WHERE x.PATIENT_ID = p.PATIENT_ID)
),

/* ------------------------------------------------------------
   Combine — SAME columns in SAME order (fixes UNION column mismatch)
   ------------------------------------------------------------ */
all_suspects AS (
  SELECT * FROM troponin_hits WHERE suspect_group IS NOT NULL
  UNION ALL
  SELECT * FROM revasc_hits  WHERE suspect_group IS NOT NULL
),

/* ------------------------------------------------------------
   Minimal FHIR payload per supporting resource
   ------------------------------------------------------------ */
with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    s.resource_type,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.RESULT,
    s.units,
    s.value_num,     -- ng/L for troponin; NULL for procedures
    s.obs_date,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', s.resource_type,
      'id',            s.resource_id,
      'status',        CASE WHEN s.resource_type = 'Procedure' THEN 'completed' ELSE 'final' END,
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  CASE
                         WHEN s.resource_type = 'Observation' THEN 'http://loinc.org'
                         WHEN s.resource_type = 'Procedure'   THEN 'http://www.ama-assn.org/go/cpt'
                       END,
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      /* Use a single date field for UI rendering */
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'performedDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity',
        IFF(s.resource_type = 'Observation' AND s.value_num IS NOT NULL,
            OBJECT_CONSTRUCT(
              'value', s.value_num,            -- already normalized to ng/L
              'unit',  'ng/L'
            ),
            NULL),
      'valueString',
        IFF(s.resource_type = 'Observation' AND s.value_num IS NULL, s.RESULT, NULL)
    ) AS fhir
  FROM all_suspects s
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
FROM with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
