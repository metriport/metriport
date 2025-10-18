/* ============================================================
   LUNG NODULE — SUSPECT QUERY (Procedure-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of lung nodules supported by:
       • Chest CT procedures, OR
       • Lung nodule biopsy procedures,
     and THEN apply nodule-context logic at the SUSPECT step.

   Exclusion (diagnosis-based):
     • ICD-10-CM codes stored WITHOUT dots. Exclude: R911 (R91.1), R918 (R91.8).
   Notes
     - Uses CORE_V3.CORE__CONDITION and CORE_V3.CORE__PROCEDURE.
     - Column “BODYSITE_SNOMED_CODE” is used as provided.
   ============================================================ */

WITH pulmonary_nodule_dx_exclusion AS (
  /* Patients already diagnosed with pulmonary nodule / abnormal lung imaging (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) IN (
    'R911',  -- Solitary pulmonary nodule
    'R918'   -- Other abnormal finding of lung on imaging
  )
),

/* -------------------------
   RAW A: Chest CT (codes only)
   ------------------------- */
raw_ct AS (
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
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      '71250',  -- CT thorax, without contrast
      '71260',  -- CT thorax, with contrast
      '71270',  -- CT thorax, without & with contrast
      '71271'   -- Low-dose CT for lung cancer screening
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '169069000',        -- Computed tomography of chest (procedure)
      '16334891000119106' -- Low-dose CT for lung cancer screening (procedure)
    )
),

/* -------------------------
   RAW B: Biopsy (codes only)
   ------------------------- */
raw_biopsy AS (
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
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      '32408',  -- Core needle biopsy, lung/mediastinum, percutaneous
      '31628',  -- Bronchoscopy w/ transbronchial lung biopsy, single lobe
      '31632',  -- Bronchoscopy add-on: each additional lobe biopsied
      '32607',  -- Thoracoscopy w/ diagnostic biopsy of lung infiltrate(s)
      '32608'   -- Thoracoscopy w/ diagnostic biopsy of lung nodule(s)/mass(es)
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '78603008', -- Biopsy of lung (procedure)
      '9911007'   -- Core needle biopsy (procedure)
    )
),

/* -------------------------
   RAW: union evidence paths (no context applied yet)
   ------------------------- */
lung_nodule_raw AS (
  SELECT * FROM raw_ct
  UNION ALL
  SELECT * FROM raw_biopsy
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
lung_nodule_norm AS (
  SELECT * FROM lung_nodule_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
lung_nodule_clean AS (
  SELECT *
  FROM lung_nodule_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM pulmonary_nodule_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: apply nodule-context logic
   ------------------------- */
lung_nodule_suspects AS (
  SELECT
    c.PATIENT_ID,
    'lung_nodule'               AS suspect_group,
    'R91.1'                      AS suspect_icd10_code,
    'Pulmonary nodule(s)' AS suspect_icd10_short_description,

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
  FROM lung_nodule_clean c
  WHERE
    UPPER(c.REASON_SNOMED_CODE) IN (
      '786838002', -- Nodule of lung (Pulmonary nodule)
      '427359005', -- Solitary nodule of lung (finding)
      '445249002'  -- Multiple nodules of lung (finding)
    )
    OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%NODULE%'
    OR UPPER(c.SNOMED_DISPLAY)        LIKE '%NODULE%'
    OR UPPER(c.NOTE_TEXT)             LIKE '%NODULE%'
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
lung_nodule_with_fhir AS (
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
  FROM lung_nodule_suspects s
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
FROM lung_nodule_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
