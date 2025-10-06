/* ============================================================
   PAD SUSPECTS — Revascularization with Exclusion
   ------------------------------------------------------------
   Purpose:
   Flag "PAD suspects" based on prior extremity revascularization
   procedures, while excluding patients with an existing PAD
   diagnosis (ICD-10 I70.2*).
   ============================================================ */

WITH pad_dx_exclusion AS (
  -- Patients already diagnosed with PAD (exclude these)
  SELECT DISTINCT c.PATIENT_ID
  FROM CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I702%'
),

revasc_hits AS (
  -- Revascularization procedures (angioplasty, atherectomy, etc.)
  SELECT
    p.PATIENT_ID,
    'pad_revasc_history' AS suspect_group,
    'I70.209'            AS suspect_icd10_code,
    'Atherosclerosis of native arteries of extremities, unspecified extremity'
                         AS suspect_icd10_short_description,

    p.PROCEDURE_ID       AS resource_id,
    'Procedure'          AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM PROCEDURE p
  WHERE p.NORMALIZED_CODE IN (
    '37226',  -- Peripheral angioplasty
    '37221'   -- Peripheral atherectomy
    -- Add more revascularization CPTs if needed
  )
    AND NOT EXISTS (SELECT 1 FROM pad_dx_exclusion x WHERE x.PATIENT_ID = p.PATIENT_ID)
),

/* Wrap each supporting procedure in minimal FHIR */
revasc_with_fhir AS (
  SELECT
    r.PATIENT_ID,
    r.suspect_group,
    r.suspect_icd10_code,
    r.suspect_icd10_short_description,
    r.resource_id,
    r.resource_type,
    r.NORMALIZED_CODE,
    r.NORMALIZED_DESCRIPTION,
    r.obs_date,
    r.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            r.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(r.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     r.NORMALIZED_CODE,
            'display',  r.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'performedDateTime', TO_CHAR(r.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM revasc_hits r
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
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM revasc_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID;
