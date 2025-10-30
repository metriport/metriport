/* ============================================================
   CAROTID ARTERY STENOSIS — STRONG SUSPECT QUERY (with FHIR)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "carotid_stenosis" suspects using ONLY STRONG evidence:
       • Catheter cerebral angiography (CPT 36215)
       • Carotid endarterectomy (CPT 35301)
     Exclude patients already diagnosed with carotid occlusion/stenosis (ICD-10 I65.*).

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

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
cas_raw AS (
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
    '36215',  -- Catheter angiography (selective)
    '35301'   -- Carotid endarterectomy
  )
),

/* -------------------------
   NORM: (no normalization needed for procedures) pass-through
   ------------------------- */
cas_norm AS (
  SELECT * FROM cas_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
cas_clean AS (
  SELECT *
  FROM cas_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM cas_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label
   ------------------------- */
cas_suspects AS (
  SELECT
    c.PATIENT_ID,
    'cas_strong_evidence' AS suspect_group,
    'I65.29'              AS suspect_icd10_code,
    'Occlusion and stenosis of carotid artery, unspecified'
                          AS suspect_icd10_short_description,

    -- carry-through for FHIR
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.obs_date,
    c.DATA_SOURCE
  FROM cas_clean c
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
cas_with_fhir AS (
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
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM cas_suspects s
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
FROM cas_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;