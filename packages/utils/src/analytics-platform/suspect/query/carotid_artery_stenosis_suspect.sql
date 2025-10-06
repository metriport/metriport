/* ============================================================
   CAROTID ARTERY STENOSIS — STRONG SUSPECT QUERY (with FHIR)
   ------------------------------------------------------------
   Purpose
     Flag "carotid_stenosis" suspects using ONLY STRONG evidence:
       • Catheter cerebral angiography (CPT 36215)
       • Carotid endarterectomy (CPT 35301)
     Exclude patients already diagnosed with carotid stenosis (ICD-10 I65.2*).

   Output
     • One row per patient × suspect_group
     • Minimal FHIR Procedure resource(s) bundled in responsible_resources
   ============================================================ */

WITH cas_dx_exclusion AS (
  -- Exclude patients already diagnosed with carotid occlusion/stenosis
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'I65%'
),

strong_hits AS (
  -- STRONG evidence: invasive confirmation or treatment
  SELECT
    p.PATIENT_ID,

    -- Suspect bucket + reviewer label (not a diagnosis itself)
    'cas_strong_evidence' AS suspect_group,
    'I65.29'              AS suspect_icd10_code,
    'Occlusion and stenosis of carotid artery, unspecified'
                          AS suspect_icd10_short_description,

    -- Supporting resource fields
    p.PROCEDURE_ID        AS resource_id,
    'Procedure'           AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE p.NORMALIZED_CODE IN (
    '36215',  -- Catheter angiography (selective)
    '35301'   -- Carotid endarterectomy
  )
    AND NOT EXISTS (
      SELECT 1 FROM cas_dx_exclusion x WHERE x.PATIENT_ID = p.PATIENT_ID
    )
),

/* ------------------------------------------------------------
   Wrap each supporting procedure in minimal FHIR
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
  FROM strong_hits s
)

SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,

  -- Enriched responsible_resources array for UI rendering
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,  -- "Procedure"
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,

  CURRENT_TIMESTAMP() AS last_run
FROM with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
