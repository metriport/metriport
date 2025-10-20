/* ============================================================
   AMPUTATION — SUSPECT QUERY (Procedure-code based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Data sources (new schema):
     • CORE__PROCEDURE  — definitive CPT amputation procedures
     • CORE__CONDITION  — ICD-10 exclusions (Z89% acquired absence)

   Purpose:
     Flag patients with evidence of limb amputation based on a
     definitive CPT “strong set,” while EXCLUDING anyone already
     documented with acquired absence of limb (ICD-10 Z89.*).

   Evidence (CPT_CODE IN):
     '27590'  -- Above-knee amputation (through femur)
     '27880'  -- Below-knee amputation (through tibia/fibula)
     '27886'  -- Re-amputation, below-knee revision
     '28800'  -- Foot amputation; midtarsal (Chopart)
     '28805'  -- Foot amputation; transmetatarsal
     '28810'  -- Ray amputation (metatarsal with toe)
     '28820'  -- Toe amputation; metatarsophalangeal (MTP) joint
     '28825'  -- Toe amputation; interphalangeal joint

   Output:
     One row per (PATIENT_ID, suspect_group) with aggregated
     responsible_resources (Procedure) each carrying a minimal
     FHIR payload for UI review.

   This is a direct functional mapping of the original logic to
   the new CORE__* schema.
   ============================================================ */

WITH amputation_dx_exclusion AS (
  /* Exclude patients already carrying an amputation/absence status diagnosis (ICD-10 Z89.*) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'Z89%'
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
amputation_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                          AS resource_id,
    'Procedure'                             AS resource_type,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    CAST(p.START_DATE AS DATE)              AS proc_date,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE UPPER(p.CPT_CODE) IN (
    '27590',  -- Above-knee amputation (through femur)
    '27880',  -- Below-knee amputation (through tibia/fibula)
    '27886',  -- Re-amputation, below-knee revision
    '28800',  -- Foot amputation; midtarsal (Chopart)
    '28805',  -- Foot amputation; transmetatarsal
    '28810',  -- Ray amputation (metatarsal with toe)
    '28820',  -- Toe amputation; metatarsophalangeal (MTP) joint
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
    c.CPT_CODE,
    c.CPT_DISPLAY,
    c.proc_date,
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
    s.CPT_CODE,
    s.CPT_DISPLAY,
    s.proc_date,
    s.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.CPT_DISPLAY, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     s.CPT_CODE,
            'display',  s.CPT_DISPLAY
          )
        )
      ),
      'performedDateTime', TO_VARCHAR(s.proc_date, 'YYYY-MM-DD')
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
