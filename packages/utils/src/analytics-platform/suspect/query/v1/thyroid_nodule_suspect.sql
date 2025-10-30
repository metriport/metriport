/* ============================================================
   THYROID NODULE — SUSPECT QUERY (Procedure-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of thyroid nodules supported by:
       • Thyroid/neck ultrasound procedures, OR
       • Thyroid nodule biopsy procedures,
     and THEN apply thyroid-nodule context at the SUSPECT step.

   Exclusion (diagnosis-based, dotless ICD-10-CM):
     • E041 (E04.1 Nontoxic single thyroid nodule)
     • E042 (E04.2 Nontoxic multinodular goiter)
     • E051 (E05.1 Thyrotoxicosis w/ toxic single thyroid nodule)
     • E052 (E05.2 Thyrotoxicosis w/ toxic multinodular goiter)

   Notes
     - Uses CORE_V3.CONDITION and CORE_V3.PROCEDURE.
     - Column “BODYSITE_SNOMED_CODE” is used as provided.
   ============================================================ */

WITH thyroid_nodule_dx_exclusion AS (
  /* Patients already carrying a thyroid nodule diagnosis (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) IN (
    'E041',  -- Nontoxic single thyroid nodule
    'E042',  -- Nontoxic multinodular goiter
    'E051',  -- Thyrotoxicosis with toxic single thyroid nodule
    'E052'   -- Thyrotoxicosis with toxic multinodular goiter
  )
),

/* -------------------------
   RAW A: Thyroid / neck ultrasound (codes only)
   ------------------------- */
raw_us AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.PERFORMED_DATE, p.END_DATE)         AS obs_date,
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
  FROM CORE_V3.PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      '76536'   -- Ultrasound, soft tissues of head/neck (e.g., thyroid), real-time with image documentation
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '433175006'  -- Ultrasonography of thyroid and parathyroid (procedure)
    )
),

/* -------------------------
   RAW B: Thyroid biopsy / FNA (codes only)
   ------------------------- */
raw_biopsy AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.PERFORMED_DATE, p.END_DATE)         AS obs_date,
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
  FROM CORE_V3.PROCEDURE p
  WHERE
    /* FNA families (first + each additional) and FNA w/ imaging guidance */
    UPPER(p.CPT_CODE) IN (
      '10021',  -- FNA, without imaging guidance; first lesion
      '10004',  -- FNA, without imaging guidance; each additional lesion
      '10005',  -- FNA, incl. ultrasound guidance; first lesion
      '10006',  -- FNA, incl. ultrasound guidance; each additional lesion
      '10007',  -- FNA, incl. fluoroscopic guidance; first lesion
      '10008',  -- FNA, incl. fluoroscopic guidance; each additional lesion
      '10009',  -- FNA, incl. CT guidance; first lesion
      '10010',  -- FNA, incl. CT guidance; each additional lesion
      '10011',  -- FNA, incl. MR guidance; first lesion
      '10012',  -- FNA, incl. MR guidance; each additional lesion
      '60100'   -- Biopsy of thyroid, percutaneous core needle
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '171989004',  -- Biopsy of lesion of thyroid gland (procedure)
      '86716004',   -- Core needle biopsy of thyroid (procedure)
      '440492007'   -- Biopsy of thyroid using ultrasound guidance (procedure)
    )
),

/* -------------------------
   RAW: union evidence paths (no context applied yet)
   ------------------------- */
thyroid_nodule_raw AS (
  SELECT * FROM raw_us
  UNION ALL
  SELECT * FROM raw_biopsy
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
thyroid_nodule_norm AS (
  SELECT * FROM thyroid_nodule_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
thyroid_nodule_clean AS (
  SELECT *
  FROM thyroid_nodule_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM thyroid_nodule_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: apply thyroid-nodule context
   ------------------------- */
thyroid_nodule_suspects AS (
  SELECT
    c.PATIENT_ID,
    'thyroid_nodule'           AS suspect_group,
    'E04.1'                     AS suspect_icd10_code,
    'Thyroid nodule(s)' AS suspect_icd10_short_description,

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
  FROM thyroid_nodule_clean c
  WHERE
    /* Reason explicitly indicates thyroid nodules */
    UPPER(c.REASON_SNOMED_CODE) IN (
      '237495005',  -- Thyroid nodule (disorder)
      '190237002',  -- Nontoxic single thyroid nodule
      '237570007'   -- Multinodular goiter (multiple thyroid nodules)
    )
    /* Or explicit thyroid nodule wording in any description/note */
    OR (UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%THYROID%' AND UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%NODUL%')
    OR (UPPER(c.SNOMED_DISPLAY)        LIKE '%THYROID%' AND UPPER(c.SNOMED_DISPLAY)        LIKE '%NODUL%')
    OR (UPPER(c.NOTE_TEXT)             LIKE '%THYROID%' AND UPPER(c.NOTE_TEXT)             LIKE '%NODUL%')
    /* Or body site is thyroid gland (helps disambiguate “nodule” elsewhere) */
    OR UPPER(c.bodysite_snomed_code) IN (
      '69748006'   -- Thyroid gland (body structure)
    )
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
thyroid_nodule_with_fhir AS (
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
  FROM thyroid_nodule_suspects s
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
FROM thyroid_nodule_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
