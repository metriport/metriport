/* ============================================================
   OSTOMY — SUSPECT QUERY (Procedure-code based, with EXCLUSION)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of an ostomy based on definitive
     CPT procedures, while EXCLUDING patients already documented
     with ostomy status (ICD-10 Z93.*).

   Evidence (PROCEDURE.NORMALIZED_CODE in):
     • Colostomy:       44320, 44188
     • Gastrostomy:     43246, 43762, 49440
     • Tracheostomy:    31615
     • Nephrostomy:     50432
     • Cholecystostomy: 47490
   ============================================================ */

WITH ostomy_dx_exclusion AS (
  -- Exclude patients already carrying an ostomy status diagnosis (ICD-10 Z93.*)
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'Z93%'
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
ostomy_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID        AS resource_id,
    'Procedure'           AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE p.NORMALIZED_CODE IN (
    '44320','44188',              -- Colostomy
    '43246','43762','49440',      -- Gastrostomy
    '31615',                      -- Tracheostomy
    '50432',                      -- Nephrostomy
    '47490'                       -- Cholecystostomy
  )
),

/* -------------------------
   NORM: (no normalization) pass-through
   ------------------------- */
ostomy_norm AS (
  SELECT * FROM ostomy_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
ostomy_clean AS (
  SELECT *
  FROM ostomy_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM ostomy_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label
   ------------------------- */
ostomy_suspects AS (
  SELECT
    c.PATIENT_ID,

    CASE
      WHEN c.NORMALIZED_CODE IN ('44320','44188') THEN 'ostomy_colostomy'
      WHEN c.NORMALIZED_CODE IN ('43246','43762','49440') THEN 'ostomy_gastrostomy'
      WHEN c.NORMALIZED_CODE =  '31615' THEN 'ostomy_tracheostomy'
      WHEN c.NORMALIZED_CODE =  '50432' THEN 'ostomy_nephrostomy'
      WHEN c.NORMALIZED_CODE =  '47490' THEN 'ostomy_cholecystostomy'
    END AS suspect_group,

    CASE
      WHEN c.NORMALIZED_CODE IN ('44320','44188') THEN 'Z93.3'
      WHEN c.NORMALIZED_CODE IN ('43246','43762','49440') THEN 'Z93.1'
      WHEN c.NORMALIZED_CODE =  '31615' THEN 'Z93.0'
      WHEN c.NORMALIZED_CODE =  '50432' THEN 'Z93.6'
      WHEN c.NORMALIZED_CODE =  '47490' THEN 'Z93.49'
    END AS suspect_icd10_code,

    CASE
      WHEN c.NORMALIZED_CODE IN ('44320','44188') THEN 'Colostomy status'
      WHEN c.NORMALIZED_CODE IN ('43246','43762','49440') THEN 'Gastrostomy status'
      WHEN c.NORMALIZED_CODE =  '31615' THEN 'Tracheostomy status'
      WHEN c.NORMALIZED_CODE =  '50432' THEN 'Nephrostomy status'
      WHEN c.NORMALIZED_CODE =  '47490' THEN 'Cholecystostomy status'
    END AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.obs_date,
    c.DATA_SOURCE
  FROM ostomy_clean c
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
ostomy_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.obs_date,
    s.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'performedDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM ostomy_suspects s
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
      'resource_type', resource_type,  -- "Procedure"
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM ostomy_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
