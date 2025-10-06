/* ============================================================
   OSTOMY — SUSPECT QUERY (Procedure-code based, with FHIR)
   ------------------------------------------------------------
   Purpose
     Flag patients with evidence of an ostomy based on definitive
     CPT/Procedure codes from the PROCEDURE table.
     Exclude patients already diagnosed with ostomy (ICD-10 Z93.*).

   Evidence (any single procedure is sufficient)
     • Colostomy creation (open/laparoscopic)
     • Gastrostomy tube insert/replace
     • Tracheostomy established
     • Nephrostomy catheter placement
     • Cholecystostomy placement

   Output
     • One row per patient × ostomy type (suspect_group)
     • Minimal FHIR Procedure for each supporting procedure
   ============================================================ */

WITH ostomy_dx_exclusion AS (
  -- Patients already diagnosed with an ostomy (exclude these)
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'Z93%'
),

ostomy_hits AS (
  -- Match procedures directly by CPT codes
  SELECT
    p.PATIENT_ID,

    CASE
      WHEN p.NORMALIZED_CODE IN ('44320','44188') THEN 'ostomy_colostomy'
      WHEN p.NORMALIZED_CODE IN ('43246','43762','49440') THEN 'ostomy_gastrostomy'
      WHEN p.NORMALIZED_CODE = '31615' THEN 'ostomy_tracheostomy'
      WHEN p.NORMALIZED_CODE = '50432' THEN 'ostomy_nephrostomy'
      WHEN p.NORMALIZED_CODE = '47490' THEN 'ostomy_cholecystostomy'
    END AS suspect_group,

    CASE
      WHEN p.NORMALIZED_CODE IN ('44320','44188') THEN 'Z93.3'
      WHEN p.NORMALIZED_CODE IN ('43246','43762','49440') THEN 'Z93.1'
      WHEN p.NORMALIZED_CODE = '31615' THEN 'Z93.0'
      WHEN p.NORMALIZED_CODE = '50432' THEN 'Z93.6'
      WHEN p.NORMALIZED_CODE = '47490' THEN 'Z93.49'
    END AS suspect_icd10_code,

    CASE
      WHEN p.NORMALIZED_CODE IN ('44320','44188') THEN 'Colostomy status'
      WHEN p.NORMALIZED_CODE IN ('43246','43762','49440') THEN 'Gastrostomy status'
      WHEN p.NORMALIZED_CODE = '31615' THEN 'Tracheostomy status'
      WHEN p.NORMALIZED_CODE = '50432' THEN 'Nephrostomy status'
      WHEN p.NORMALIZED_CODE = '47490' THEN 'Cholecystostomy status'
    END AS suspect_icd10_short_description,

    p.PROCEDURE_ID        AS resource_id,
    'Procedure'           AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE p.NORMALIZED_CODE IN (
    '44320','44188', -- Colostomy
    '43246','43762','49440', -- Gastrostomy
    '31615', -- Tracheostomy
    '50432', -- Nephrostomy
    '47490'  -- Cholecystostomy
  )
    AND NOT EXISTS (
      SELECT 1 FROM ostomy_dx_exclusion x WHERE x.PATIENT_ID = p.PATIENT_ID
    )
),

with_fhir AS (
  -- Wrap in minimal FHIR
  SELECT
    h.PATIENT_ID,
    h.suspect_group,
    h.suspect_icd10_code,
    h.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            h.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(h.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     h.NORMALIZED_CODE,
            'display',  h.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'performedDateTime', TO_CHAR(h.obs_date, 'YYYY-MM-DD')
    ) AS fhir,

    h.resource_id,
    h.resource_type,
    h.DATA_SOURCE AS data_source
  FROM ostomy_hits h
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
FROM with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
