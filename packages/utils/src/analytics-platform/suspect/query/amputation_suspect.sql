/* ============================================================
   AMPUTATION — SUSPECT QUERY (Procedure-code based, with EXCLUSION)
   ------------------------------------------------------------
   Purpose
     Flag patients with evidence of limb amputation based solely
     on definitive amputation CPT procedures, while EXCLUDING
     patients already documented with amputation status (ICD-10 Z89.*).

   Evidence (PROCEDURE.NORMALIZED_CODE in):
     • 27590  — Amputation, thigh (above-knee)
     • 27880  — Amputation, leg through tibia/fibula (below-knee)
     • 27886  — Re-amputation, leg (below-knee revision)
     • 28800  — Amputation, foot; midtarsal (Chopart)
     • 28805  — Amputation, foot; transmetatarsal
     • 28810  — Ray amputation (metatarsal with toe)
     • 28820  — Toe amputation; MTP joint
     • 28825  — Toe amputation; interphalangeal joint

   Notes
     - Presence of these procedures is sufficient to flag
       "amputation_history" suspects.
     - Patients with Z89.* (acquired absence of limb) are excluded.
     - Minimal FHIR Procedure resources are embedded for the UI.

   Output
     • One row per patient with suspect_group = 'amputation_history'
     • responsible_resources = array of supporting Procedure FHIRs
   ============================================================ */

WITH amputation_dx_exclusion AS (
  -- Exclude patients already carrying an amputation/absence status diagnosis (ICD-10 Z89.*)
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'Z89%'
),

amputation_procedures AS (
  SELECT
    p.PATIENT_ID,

    /* Suspect bucket & reviewer label (not a diagnosis by itself) */
    'amputation_history' AS suspect_group,
    'Z89.9'              AS suspect_icd10_code,
    'Acquired absence of limb, unspecified' AS suspect_icd10_short_description,

    /* Supporting resource fields */
    p.PROCEDURE_ID        AS resource_id,
    'Procedure'           AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE p.NORMALIZED_CODE IN (
    '27590',  -- Above-knee amputation (through femur)
    '27880',  -- Below-knee amputation (through tibia/fibula)
    '27886',  -- Re-amputation, below-knee revision
    '28800',  -- Foot amputation; midtarsal (Chopart)
    '28805',  -- Foot amputation; transmetatarsal
    '28810',  -- Ray amputation (metatarsal with toe)
    '28820',  -- Toe amputation; MTP joint
    '28825'   -- Toe amputation; interphalangeal joint
  )
    AND NOT EXISTS (  -- Exclude patients already confirmed via diagnosis
      SELECT 1
      FROM amputation_dx_exclusion x
      WHERE x.PATIENT_ID = p.PATIENT_ID
    )
),

/* Build minimal FHIR for each supporting Procedure */
with_fhir AS (
  SELECT
    a.PATIENT_ID,
    a.suspect_group,
    a.suspect_icd10_code,
    a.suspect_icd10_short_description,

    a.resource_id,
    a.resource_type,
    a.NORMALIZED_CODE,
    a.NORMALIZED_DESCRIPTION,
    a.obs_date,
    a.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            a.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(a.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     a.NORMALIZED_CODE,
            'display',  a.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'performedDateTime', TO_CHAR(a.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM amputation_procedures a
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
      'resource_type', resource_type,  -- "Procedure"
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,

  CURRENT_TIMESTAMP() AS last_run
FROM with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
