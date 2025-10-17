/* ============================================================
   DIABETIC RETINOPATHY (DR) — SUSPECT QUERY
   (Procedure-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence consistent with diabetic retinopathy supported by:
       • Comprehensive eye exam / retinal imaging procedures,
     and THEN require DR-specific context at the SUSPECT step.

   Exclusion (diagnosis-based; ICD-10-CM stored WITHOUT dots):
     • H360%  = Diabetic retinopathy (eye chapter)
     • E083%  = Diabetes due to underlying condition w/ ophthalmic complications
     • E093%  = Drug/chemical induced diabetes w/ ophthalmic complications
     • E103%  = Type 1 diabetes mellitus w/ ophthalmic complications
     • E113%  = Type 2 diabetes mellitus w/ ophthalmic complications
     • E133%  = Other specified diabetes mellitus w/ ophthalmic complications

   Notes
     - Uses CORE_V3.CORE__CONDITION and CORE_V3.CORE__PROCEDURE.
     - This SUSPECT step explicitly whitelists known SNOMED "reason" codes
       and guards against "without retinopathy".
   ============================================================ */

WITH dr_dx_exclusion AS (
  /* Patients already diagnosed with DR (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE
    UPPER(c.ICD_10_CM_CODE) LIKE 'H360%'  -- Diabetic retinopathy (H36.0x)
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'E083%'  -- DM w ophthalmic complications
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'E093%'
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'E103%'
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'E113%'
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'E133%'
),

/* -------------------------
   RAW: Eye exam / retinal imaging (codes only)
   ------------------------- */
raw_eye AS (
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
    p.BODYSITE_SNOMED_CODE                     AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      '92004', -- Comprehensive ophthalmological services (new)
      '92014', -- Comprehensive ophthalmological services (established)
      '92134', -- OCT, retina (posterior segment)
      '92250', -- Fundus photography w/ interpretation & report
      '92227', -- Remote retinal imaging (store-and-forward) – detection
      '92228', -- Remote retinal imaging (store-and-forward) – monitoring
      '92229', -- Retinal imaging w/ automated point-of-care AI (often DR)
      '92235'  -- Fluorescein angiography
    )
    AND NULLIF(p.REASON_SNOMED_CODE, '') IS NOT NULL
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
dr_norm AS (
  SELECT * FROM raw_eye
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
dr_clean AS (
  SELECT *
  FROM dr_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM dr_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: DR context
   ------------------------- */
dr_suspects AS (
  SELECT
    c.PATIENT_ID,
    'diabetic_retinopathy'          AS suspect_group,
    'H360'                          AS suspect_icd10_code,
    'Diabetic retinopathy'          AS suspect_icd10_short_description,

    /* carry-through for FHIR */
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
  FROM dr_clean c
  WHERE
    /* (1) Direct whitelist of known DR reason codes */
    c.REASON_SNOMED_CODE IN (
      '16746341000119103', -- Moderate NPDR, bilateral, due to T2DM
      '16745531000119108', -- Mild NPDR, left eye, due to T2DM
      '16745411000119104', -- Mild NPDR, bilateral, due to T1DM
      '16745931000119102', -- Mild NPDR, bilateral, due to T2DM
      '16747901000119104', -- Proliferative retinopathy, left eye, due to T2DM
      '16748141000119100', -- Proliferative retinopathy, bilateral, due to T2DM
      '16745651000119101', -- Mild NPDR, right eye, due to T2DM
      '59276001',          -- Proliferative retinopathy due to diabetes mellitus
      '16747021000119109', -- Severe NPDR, bilateral, due to T2DM
      '97331000119101',    -- Macular edema and retinopathy due to T2DM
      '816177009',         -- Nonproliferative retinopathy, left eye, due to DM
      '390834004',         -- Nonproliferative retinopathy due to DM
      '1501000119109',     -- Proliferative retinopathy due to T2DM
      '422034002',         -- Retinopathy due to T2DM
      '1551000119108'      -- Nonproliferative retinopathy due to T2DM
    )
    /* Guard against “without retinopathy” (e.g., 1481000119100) */
    AND c.REASON_SNOMED_CODE NOT IN (
      '1481000119100'      -- Diabetes mellitus type 2 without retinopathy
    )

    /* (2) OR robust text logic that requires BOTH diabetes and retinopathy,
           but explicitly excludes “without/no/absent retinopathy”. */
    OR (
      (
        UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%DIABET%'
        OR UPPER(c.SNOMED_DISPLAY)     LIKE '%DIABET%'
        OR UPPER(c.NOTE_TEXT)          LIKE '%DIABET%'
      )
      AND
      (
        UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%RETINOPATHY%'
        OR UPPER(c.SNOMED_DISPLAY)     LIKE '%RETINOPATHY%'
        OR UPPER(c.NOTE_TEXT)          LIKE '%RETINOPATHY%'
      )
      AND NOT (
        UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%WITHOUT%RETINOPATHY%'
        OR UPPER(c.SNOMED_DISPLAY)     LIKE '%WITHOUT%RETINOPATHY%'
        OR UPPER(c.NOTE_TEXT)          LIKE '%WITHOUT%RETINOPATHY%'
        OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%NO%RETINOPATHY%'
        OR UPPER(c.SNOMED_DISPLAY)     LIKE '%NO%RETINOPATHY%'
        OR UPPER(c.NOTE_TEXT)          LIKE '%NO%RETINOPATHY%'
        OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%ABSENT%RETINOPATHY%'
        OR UPPER(c.SNOMED_DISPLAY)     LIKE '%ABSENT%RETINOPATHY%'
        OR UPPER(c.NOTE_TEXT)          LIKE '%ABSENT%RETINOPATHY%'
      )
    )
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
dr_with_fhir AS (
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
  FROM dr_suspects s
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
      'resource_type', 'Procedure',
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM dr_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
