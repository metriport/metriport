/* ============================================================
   PAD — SUSPECT QUERY (Procedure-code based, with EXCLUSION) — NEW SCHEMAS
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of peripheral arterial disease
     (PAD) based on prior extremity revascularization procedures,
     while EXCLUDING patients already documented with PAD (ICD-10 I70.2*).

   Evidence (PROCEDURE.CPT_CODE in):
     • Lower-extremity endovascular revascularization:
       37221 (atherectomy), 37226 (angioplasty)
       -- Add additional CPTs as needed per coding spec
   ============================================================ */

WITH pad_dx_exclusion AS (
  -- Exclude patients already carrying a PAD diagnosis (ICD-10 I70.2*)
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'I702%'
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
pad_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                         AS resource_id,
    'Procedure'                            AS resource_type,
    p.CPT_CODE                             AS code,
    p.CPT_DISPLAY                          AS display,
    CAST(p.START_DATE AS DATE)             AS obs_date,
    p.DATA_SOURCE
  FROM CORE__PROCEDURE p
  WHERE p.CPT_CODE IN (
    '37221',  -- Lower-extremity endovascular atherectomy (per spec)
    '37226'   -- Lower-extremity endovascular angioplasty (per spec)
    -- Add more revascularization CPTs if needed
  )
),

/* -------------------------
   NORM: (no normalization) pass-through
   ------------------------- */
pad_norm AS (
  SELECT * FROM pad_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
pad_clean AS (
  SELECT *
  FROM pad_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM pad_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label
   ------------------------- */
pad_suspects AS (
  SELECT
    c.PATIENT_ID,
    'pad_revasc_history' AS suspect_group,
    'I70.209'            AS suspect_icd10_code,
    'Atherosclerosis of native arteries of extremities, unspecified extremity'
                         AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.code,
    c.display,
    c.obs_date,
    c.DATA_SOURCE
  FROM pad_clean c
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
pad_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.code,
    s.display,
    s.obs_date,
    s.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.display,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     s.code,
            'display',  s.display
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM pad_suspects s
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
FROM pad_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
