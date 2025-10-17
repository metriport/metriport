/* ============================================================
   BARRETT'S ESOPHAGUS — SUSPECT QUERY (Procedure-based, with EXCLUSION)
   ---------------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose (SUSPECTING)
     Flag patients with EITHER:
       • Endoscopic evidence consistent with Barrett’s on EGD, OR
       • Histopathologic evidence of intestinal metaplasia (IM).
   Rationale
     Clinically, diagnosis requires BOTH; for suspecting, OR increases recall.

   Exclusion (diagnosis-based, dotless ICD-10-CM):
     • K2270  Barrett’s esophagus without dysplasia
     • K22710 Barrett’s esophagus with low-grade dysplasia
     • K22711 Barrett’s esophagus with high-grade dysplasia
     • K22719 Barrett’s esophagus with dysplasia, unspecified

   Notes
     - Uses CORE_V3.CORE__CONDITION and CORE_V3.CORE__PROCEDURE.
     - Column “BODYSITE_SNOMED_CODE” is used as provided.
   ============================================================ */

WITH barrett_dx_exclusion AS (
  /* Patients already diagnosed with Barrett’s (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) IN (
    'K2270',   -- Barrett's esophagus without dysplasia
    'K22710',  -- Barrett's esophagus with low-grade dysplasia
    'K22711',  -- Barrett's esophagus with high-grade dysplasia
    'K22719'   -- Barrett's esophagus with dysplasia, unspecified
  )
),

/* -------------------------
   RAW A: EGD family (codes only)
   ------------------------- */
raw_egd AS (
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
      '43235',  -- EGD, diagnostic
      '43239',  -- EGD with biopsy
      '43238'   -- EGD with EUS-guided FNA/biopsy
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '423827005', -- Esophagogastroduodenoscopy (procedure)
      '53767003',  -- Endoscopic biopsy (procedure)
      '446016009'  -- Upper GI endoscopy + mucosal excision (EGD context)
    )
),

/* -------------------------
   RAW B: Pathology / Surgical pathology (codes only)
   ------------------------- */
raw_path AS (
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
      '88305'  -- Surgical pathology, gross & microscopic exam (typical for esophageal biopsies)
    )
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
egd_norm  AS (SELECT * FROM raw_egd),
path_norm AS (SELECT * FROM raw_path),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
egd_clean AS (
  SELECT *
  FROM egd_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM barrett_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),
path_clean AS (
  SELECT *
  FROM path_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM barrett_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: OR logic
   A) EGD evidence consistent with Barrett’s
   B) Path evidence of intestinal metaplasia
   ------------------------- */
egd_suspects AS (
  SELECT
    e.PATIENT_ID,
    'barretts_esophagus'       AS suspect_group,
    'K227'                     AS suspect_icd10_code,
    'Barrett\'s esophagus'     AS suspect_icd10_short_description,

    e.resource_id,
    e.resource_type,
    e.status,
    e.obs_date,
    e.CPT_CODE,
    e.CPT_DISPLAY,
    e.SNOMED_CODE,
    e.SNOMED_DISPLAY,
    e.bodysite_snomed_code,
    e.bodysite_snomed_display,
    e.REASON_SNOMED_CODE,
    e.REASON_SNOMED_DISPLAY,
    e.NOTE_TEXT,
    e.DATA_SOURCE
  FROM egd_clean e
  WHERE
    UPPER(e.REASON_SNOMED_CODE) IN (
      '302914006'  -- Barrett's esophagus (disorder)
    )
    OR UPPER(e.REASON_SNOMED_DISPLAY) LIKE '%BARRETT%'
    OR UPPER(e.SNOMED_DISPLAY)        LIKE '%BARRETT%'
    OR UPPER(e.NOTE_TEXT)             LIKE '%BARRETT%'
    OR UPPER(e.NOTE_TEXT)             LIKE '%SALMON%'   -- “salmon-colored” mucosa
    OR UPPER(e.bodysite_snomed_code) IN (
      '32849002',  -- Esophageal structure
      '25271004',  -- Cardioesophageal (gastroesophageal) junction structure
      '362130006'  -- Entire cardioesophageal junction
    )
),
path_suspects AS (
  SELECT
    p.PATIENT_ID,
    'barretts_esophagus'       AS suspect_group,
    'K227'                     AS suspect_icd10_code,
    'Barrett\'s esophagus'     AS suspect_icd10_short_description,

    p.resource_id,
    p.resource_type,
    p.status,
    p.obs_date,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,
    NULL                       AS bodysite_snomed_code,
    NULL                       AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM path_clean p
  WHERE
    UPPER(p.REASON_SNOMED_CODE) IN (
      '69310004'  -- Intestinal metaplasia (morphologic abnormality)
    )
    OR UPPER(p.REASON_SNOMED_DISPLAY) LIKE '%INTESTINAL%METAPLASIA%'
    OR UPPER(p.SNOMED_DISPLAY)        LIKE '%INTESTINAL%METAPLASIA%'
    OR UPPER(p.NOTE_TEXT)             LIKE '%INTESTINAL%METAPLASIA%'
    OR UPPER(p.NOTE_TEXT)             LIKE '%GOBLET%'  -- “goblet cells”
),

barrett_suspect_resources AS (
  SELECT * FROM egd_suspects
  UNION ALL
  SELECT * FROM path_suspects
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
barrett_with_fhir AS (
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
  FROM barrett_suspect_resources s
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
FROM barrett_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
