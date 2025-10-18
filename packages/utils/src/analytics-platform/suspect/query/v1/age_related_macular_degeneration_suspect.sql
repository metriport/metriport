/* ============================================================
   AGE-RELATED MACULAR DEGENERATION (AMD) — SUSPECT QUERY
   (Procedure-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence consistent with AMD supported by:
       • Comprehensive eye exam / retinal imaging procedures,
     and THEN apply AMD-context logic at the SUSPECT step.

   Exclusion (diagnosis-based; ICD-10-CM stored WITHOUT dots):
     • Exclude H353*  (Age-related macular degeneration, any laterality/severity)

   Notes
     - Uses CORE_V3.CORE__CONDITION and CORE_V3.CORE__PROCEDURE.
     - Column “BODYSITE_SNOMED_ODE” is used as provided (typo preserved from schema).
   ============================================================ */

WITH amd_dx_exclusion AS (
  /* Patients already diagnosed with age-related macular degeneration (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'H353%'  -- AMD (any)
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
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
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
      '92229', -- Retinal imaging w/ automated point-of-care AI
      '92235'  -- Fluorescein angiography
    )
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
amd_norm AS (
  SELECT * FROM raw_eye
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
amd_clean AS (
  SELECT *
  FROM amd_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM amd_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: apply AMD-context logic
   ------------------------- */
amd_suspects AS (
  SELECT
    c.PATIENT_ID,
    'amd'                            AS suspect_group,
    'H35.3'                           AS suspect_icd10_code,
    'Age-related macular degeneration' AS suspect_icd10_short_description,

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
  FROM amd_clean c
  WHERE
    UPPER (c.REASON_SNOMED_DISPLAY) LIKE '%AGE-RELATED%'
    
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
amd_with_fhir AS (
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
  FROM amd_suspects s
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
FROM amd_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
