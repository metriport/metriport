/* ============================================================
   HISTORY OF CEREBROVASCULAR ACCIDENT (CVA) — SUSPECT QUERY
   (adds NIHSS Observation evidence: LOINC 70182-1 / 72089-6; NIHSS > 0)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   ============================================================ */

WITH cva_history_dx_exclusion AS (
  /* Patients already carrying explicit "history/sequelae of stroke" */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE
    UPPER(c.ICD_10_CM_CODE) IN (
      'Z8673'   -- Personal history of TIA and cerebral infarction without residual deficits
    )
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'I69%'  -- Sequelae of cerebrovascular disease (any)
),

/* -------------------------
   RAW A: Neuro imaging (codes only)
   ------------------------- */
raw_imaging AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.START_DATE, p.END_DATE)         AS obs_date,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
    /* CT head + CTA head/neck */
    UPPER(p.CPT_CODE) IN (
      '70450',  -- CT head/brain w/o contrast
      '70460',  -- CT head/brain w contrast
      '70470',  -- CT head/brain w & w/o
      '70496',  -- CTA head w contrast (incl. noncontrast, post-processing)
      '70498'   -- CTA neck w contrast (incl. noncontrast, post-processing)
    )
    OR UPPER(p.CPT_CODE) IN (
      /* MRI brain and MRA head/neck */
      '70551',  -- MRI brain w/o contrast
      '70552',  -- MRI brain w contrast
      '70553',  -- MRI brain w & w/o
      '70544',  -- MRA head w/o contrast
      '70545',  -- MRA head w contrast
      '70546',  -- MRA head w & w/o
      '70547',  -- MRA neck w/o contrast
      '70548',  -- MRA neck w contrast
      '70549'   -- MRA neck w & w/o
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '816077007' -- Magnetic resonance imaging of brain (procedure)
    )
),

/* -------------------------
   RAW B: Reperfusion therapy (codes only)
   ------------------------- */
raw_reperfusion AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.START_DATE, p.END_DATE)         AS obs_date,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      '61645'   -- Intracranial mechanical thrombectomy and/or thrombolytic infusion
    )
    OR UPPER(p.CPT_CODE) IN (
      'J2997',  -- Injection, alteplase (tPA), 1 mg
      'J3101'   -- Injection, tenecteplase (TNK), 1 mg
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '426347000' -- Thrombolytic therapy (procedure)
    )
),

/* -------------------------
   RAW C: NIH Stroke Scale (Observation, codes only)
   ------------------------- */
obs_nihss_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                           AS resource_id,
    'Observation'                              AS resource_type,
    COALESCE(NULLIF(o.STATUS,''), 'final')     AS status,
    COALESCE(o.START_DATE, o.END_DATE)         AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS,
    o.NOTE_TEXT,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '70182-1',  -- NIH Stroke Scale (NIHSS) panel
    '72089-6'   -- NIHSS total score
  )
),

/* -------------------------
   RAW: union evidence paths (no context yet)
   ------------------------- */
cva_raw AS (
  SELECT * FROM raw_imaging
  UNION ALL
  SELECT * FROM raw_reperfusion
),
/* NIHSS path stays separate for Observation FHIR construction */
nihss_norm AS (SELECT * FROM obs_nihss_raw),

/* -------------------------
   NORM: pass-through for procedures
   ------------------------- */
cva_norm AS (SELECT * FROM cva_raw),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
cva_clean AS (
  SELECT *
  FROM cva_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM cva_history_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),
nihss_clean AS (
  SELECT *
  FROM nihss_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM cva_history_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SCORE NIHSS: numeric value from RESULT; require > 0
   ------------------------- */
nihss_scored AS (
  SELECT
    n.*,
    /* Prefer numeric RESULT; NIHSS is unitless—UNITS may be blank */
    CASE
      WHEN UPPER(n.LOINC_CODE) = '72089-6' THEN TRY_TO_NUMBER(n.RESULT)
      WHEN UPPER(n.LOINC_CODE) = '70182-1' THEN TRY_TO_NUMBER(n.RESULT)  -- keep simple; panel may carry a total
      ELSE NULL
    END AS nihss_score
  FROM nihss_clean n
),

/* -------------------------
   SUSPECT: require explicit STROKE context for PROCEDURE paths
   (NIHSS contributes only when score > 0)
   ------------------------- */
cva_suspects AS (
  SELECT
    c.PATIENT_ID,
    'cva_history'                                                               AS suspect_group,
    'Z86.73'                                                                    AS suspect_icd10_code,
    'History of Cerebrovascular Accident (CVA)'                                 AS suspect_icd10_short_description,

    /* carry-through for FHIR (Procedure) */
    c.resource_id,
    c.resource_type,
    c.status,
    c.obs_date,
    c.CPT_CODE,
    c.CPT_DISPLAY,
    c.SNOMED_CODE,
    c.SNOMED_DISPLAY,
    c.bodysite_snomed_code,
    c.bodysite_snomed_display,
    c.REASON_SNOMED_CODE,
    c.REASON_SNOMED_DISPLAY,
    c.NOTE_TEXT,
    c.DATA_SOURCE
  FROM cva_clean c
  WHERE
    UPPER(c.REASON_SNOMED_CODE) IN (
      '230690007', -- Cerebrovascular accident (stroke) (disorder)
      '422504002'  -- Ischemic stroke (disorder)
    )
    OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE ANY (
      '%STROKE%',
      '%CVA%',
      '%CEREBRAL INFARCT%',
      '%CEREBRAL INFARCTION%',
      '%BRAIN INFARCT%',
      '%HEMORRHAGIC STROKE%',
      '%INTRACEREBRAL HEMORRHAGE%'
    )
    OR UPPER(c.SNOMED_DISPLAY) LIKE ANY (
      '%STROKE%',
      '%CVA%',
      '%CEREBRAL INFARCT%',
      '%CEREBRAL INFARCTION%',
      '%BRAIN INFARCT%',
      '%HEMORRHAGIC STROKE%',
      '%INTRACEREBRAL HEMORRHAGE%'
    )
    OR UPPER(c.NOTE_TEXT) LIKE ANY (
      '%STROKE%',
      '%CVA%',
      '%NIHSS%',
      '%CEREBRAL INFARCT%',
      '%CEREBRAL INFARCTION%',
      '%BRAIN INFARCT%',
      '%HEMORRHAGIC STROKE%',
      '%INTRACEREBRAL HEMORRHAGE%'
    )
),

nihss_suspects AS (
  /* Only NIHSS with a positive numeric score contributes */
  SELECT
    n.PATIENT_ID,
    'cva_history_nihss'                                                         AS suspect_group,
    'Z8673'                                                                     AS suspect_icd10_code,
    'Personal history of TIA and cerebral infarction without residual deficits' AS suspect_icd10_short_description,

    /* carry-through for FHIR (Observation) */
    n.resource_id,
    n.resource_type,
    n.status,
    n.obs_date,
    /* Map LOINC into generic slots for use in FHIR builder below */
    NULL AS CPT_CODE,
    NULL AS CPT_DISPLAY,
    n.LOINC_CODE       AS LOINC_CODE,
    n.LOINC_DISPLAY    AS LOINC_DISPLAY,
    NULL AS SNOMED_CODE,
    NULL AS SNOMED_DISPLAY,
    NULL AS bodysite_snomed_code,
    NULL AS bodysite_snomed_display,
    NULL AS REASON_SNOMED_CODE,
    NULL AS REASON_SNOMED_DISPLAY,
    n.NOTE_TEXT        AS NOTE_TEXT,
    n.DATA_SOURCE,
    n.RESULT,
    n.UNITS,
    n.nihss_score
  FROM nihss_scored n
  WHERE n.nihss_score > 0
),

/* -------------------------
   FHIR: build Procedure and Observation evidence separately
   ------------------------- */
cva_with_fhir_procedure AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'completed'),
      'code', OBJECT_CONSTRUCT(
        'text',   COALESCE(NULLIF(s.CPT_DISPLAY,''), NULLIF(s.SNOMED_DISPLAY,'')),
        'coding', ARRAY_CONSTRUCT_COMPACT(
          IFF(s.CPT_CODE IS NOT NULL AND s.CPT_CODE <> '',
            OBJECT_CONSTRUCT(
              'system',  'http://www.ama-assn.org/go/cpt',
              'code',     s.CPT_CODE,
              'display',  NULLIF(s.CPT_DISPLAY,'')
            ),
            NULL
          ),
          IFF(s.SNOMED_CODE IS NOT NULL AND s.SNOMED_CODE <> '',
            OBJECT_CONSTRUCT(
              'system',  'http://snomed.info/sct',
              'code',     s.SNOMED_CODE,
              'display',  NULLIF(s.SNOMED_DISPLAY,'')
            ),
            NULL
          )
        )
      ),
      'bodySite', IFF(s.bodysite_snomed_code IS NOT NULL AND s.bodysite_snomed_code <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(s.bodysite_snomed_display,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system', 'http://snomed.info/sct',
                'code',    s.bodysite_snomed_code,
                'display', NULLIF(s.bodysite_snomed_display,'')
              )
            )
          )
        ),
        NULL
      ),
      'reasonCode', IFF(s.REASON_SNOMED_CODE IS NOT NULL AND s.REASON_SNOMED_CODE <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(s.REASON_SNOMED_DISPLAY,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system', 'http://snomed.info/sct',
                'code',    s.REASON_SNOMED_CODE,
                'display', NULLIF(s.REASON_SNOMED_DISPLAY,'')
              )
            )
          )
        ),
        NULL
      ),
      'note', IFF(s.NOTE_TEXT IS NOT NULL AND s.NOTE_TEXT <> '',
        ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('text', s.NOTE_TEXT)),
        NULL
      ),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM cva_suspects s
),

cva_with_fhir_observation AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'final'),
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.LOINC_CODE,
            'display',  NULLIF(s.LOINC_DISPLAY,'')
          )
        )
      ),
      'valueQuantity', IFF(s.nihss_score IS NOT NULL,
        OBJECT_CONSTRUCT(
          'value', s.nihss_score,
          'unit',  NULL    -- NIHSS is unitless
        ),
        NULL
      ),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM nihss_suspects s
),

cva_with_fhir_all AS (
  SELECT * FROM cva_with_fhir_procedure
  UNION ALL
  SELECT * FROM cva_with_fhir_observation
)

/* -------------------------
   RETURN
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
FROM cva_with_fhir_all
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
