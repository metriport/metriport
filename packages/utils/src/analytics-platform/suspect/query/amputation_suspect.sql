/* ============================================================
   AMPUTATION — SUSPECT QUERY (Procedure-code based, with EXCLUSION)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of limb amputation based on
     definitive CPT procedures, while EXCLUDING patients already
     documented with acquired absence of limb (ICD-10 Z89.*).

   Evidence (PROCEDURE.NORMALIZED_CODE in):
     • 27590, 27880, 27886, 28800, 28805, 28810, 28820, 28825
   ============================================================ */

WITH amputation_dx_exclusion AS (
  -- Exclude patients already carrying an amputation/absence status diagnosis (ICD-10 Z89.*)
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c 
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'Z89%'
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
amputation_raw AS (
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
    '27590',  -- Above-knee amputation (through femur)
    '27880',  -- Below-knee amputation (through tibia/fibula)
    '27886',  -- Re-amputation, below-knee revision
    '28800',  -- Foot amputation; midtarsal (Chopart)
    '28805',  -- Foot amputation; transmetatarsal
    '28810',  -- Ray amputation (metatarsal with toe)
    '28820',  -- Toe amputation; MTP joint
    '28825'   -- Toe amputation; interphalangeal joint
  )
),

/* -------------------------
   NORM: (no normalization needed) pass-through
   ------------------------- */
amputation_norm AS (
  SELECT * FROM amputation_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
amputation_clean AS (
  SELECT *
  FROM amputation_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM amputation_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label
   ------------------------- */
amputation_suspects AS (
  SELECT
    c.PATIENT_ID,
    'amputation_history' AS suspect_group,
    'Z89.9'              AS suspect_icd10_code,
    'Acquired absence of limb, unspecified' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.obs_date,
    c.DATA_SOURCE
  FROM amputation_clean c
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
amputation_with_fhir AS (
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
  FROM amputation_suspects s
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
FROM amputation_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
