/* ============================================================
   AORTIC ANEURYSM — SUSPECT QUERY (Procedure/Observation-based, with EXCLUSION)
   -----------------------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of aortic aneurysm supported by:
       • Aorta-focused imaging (US/CTA/MRA) procedures, OR
       • Prior aortic aneurysm repair surgery (EVAR/TEVAR), OR
       • Observation evidence suggesting AAA size (≥ 3.0 cm),
     and THEN apply aneurysm-context logic at SUSPECT
     (repairs are considered aneurysm-specific and included directly).

   Exclusion (diagnosis-based; ICD-10-CM stored WITHOUT dots):
     • I71*  (Aortic aneurysm and dissection; any)

   Notes
     - Uses CORE_V3.CORE__CONDITION, CORE_V3.CORE__PROCEDURE, CORE_V3.CORE__OBSERVATION.
     - All UNION branches now align to the same 22-column schema.
   ============================================================ */

WITH aortic_aneurysm_dx_exclusion AS (
  /* Patients already diagnosed with aortic aneurysm/dissection (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'I71%'  -- Aortic aneurysm & dissection
),

/* -------------------------
   RAW A: Aorta-focused imaging (codes only)
   ------------------------- */
raw_imaging AS (
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
      '93978', -- Duplex scan of aorta/IVC/iliac, complete bilateral
      '93979'  -- Duplex scan of aorta/IVC/iliac, unilateral/limited
    )
    OR UPPER(p.CPT_CODE) IN (
      '71275', -- CTA chest
      '74174', -- CTA abdomen & pelvis (with post-processing)
      '75635'  -- CTA abdominal aorta with bilateral iliofemoral runoff
    )
    OR UPPER(p.CPT_CODE) IN (
      '71555', -- MRA chest
      '74185'  -- MRA abdomen
    )
),

/* -------------------------
   RAW B: Prior aneurysm repair (EVAR/TEVAR; codes only)
   ------------------------- */
raw_repair AS (
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
    /* EVAR family (endovascular abdominal aortic repair) */
    UPPER(p.CPT_CODE) IN (
        '34701', -- EVAR, modular bifurcated endograft (primary)
        '34702', -- EVAR, aorto-uni-iliac (AUI) endograft (primary)
        '34703', -- EVAR, iliac branched endograft (IBE)
        '34704', -- EVAR, endograft extension(s) to iliac system
        '34705', -- EVAR, modular bifurcated + additional extensions
        '34706', -- EVAR, AUI configuration + adjunct (e.g., fem-fem bypass)
        '34707', -- EVAR, iliac limb extension (unilateral)
        '34708'  -- EVAR, iliac limb extensions (bilateral)
    )
    /* TEVAR family (thoracic endovascular aortic repair) */
    OR UPPER(p.CPT_CODE) IN (
        '33880', -- TEVAR, descending thoracic aorta (primary)
        '33881', -- TEVAR, additional thoracic segment/variation (primary)
        '33882', -- TEVAR, proximal extension
        '33883', -- TEVAR, distal extension
        '33886', -- TEVAR, additional endograft work/extension
        '33887', -- TEVAR, additional endograft work/extension
        '33889', -- TEVAR, open arterial exposure/repair (add-on)
        '33891'  -- TEVAR, additional open work/closure (add-on)
    )
),

/* -------------------------
   RAW C1: LOINC imaging "document" observations (aorta series)
   ------------------------- */
obs_docs_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                           AS resource_id,
    'Observation'                              AS resource_type,
    COALESCE(NULLIF(o.STATUS,''), 'final')     AS status,
    COALESCE(o.START_DATE, o.END_DATE)         AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS,
    o.BODYSITE_SNOMED_CT_CODE,
    o.BODYSITE_SNOMED_CT_DISPLAY,
    o.NOTE_TEXT,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '24602-7',  -- MR Abd aorta
    '24612-6',  -- MR Chest aorta
    '24649-8',  -- CT angiogram Abd aorta
    '69276-4'   -- US Abd aorta study
  )
),

/* -------------------------
   RAW C2: LOINC measurement observations (aortic diameter)
   ------------------------- */
obs_meas_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                           AS resource_id,
    'Observation'                              AS resource_type,
    COALESCE(NULLIF(o.STATUS,''), 'final')     AS status,
    COALESCE(o.START_DATE, o.END_DATE)         AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS,
    o.BODYSITE_SNOMED_CT_CODE,
    o.BODYSITE_SNOMED_CT_DISPLAY,
    o.NOTE_TEXT,
    o.DATA_SOURCE
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '18010-9', -- Aorta diameter by US
    '18011-7', -- Aortic arch diameter by US
    '18012-5', -- Ascending aorta diameter by US
    '18013-3', -- Descending aorta diameter by US
    '18015-8', -- Aortic root diameter by US
    '78176-5'  -- Aorta abdominal US (panel/context)
  )
),

/* -------------------------
   RAW: union procedure evidence; obs paths separate
   ------------------------- */
aa_proc_raw AS (
  SELECT * FROM raw_imaging
  UNION ALL
  SELECT * FROM raw_repair
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
aa_proc_norm  AS (SELECT * FROM aa_proc_raw),
obs_docs_norm AS (SELECT * FROM obs_docs_raw),
obs_meas_norm AS (SELECT * FROM obs_meas_raw),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
aa_proc_clean AS (
  SELECT *
  FROM aa_proc_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM aortic_aneurysm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),
obs_docs_clean AS (
  SELECT *
  FROM obs_docs_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM aortic_aneurysm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),
obs_meas_clean AS (
  SELECT *
  FROM obs_meas_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM aortic_aneurysm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT 1: Procedure imaging with explicit aneurysm context
   (Columns aligned to 22-col canonical projection)
   ------------------------- */
aa_proc_context AS (
  SELECT
    c.PATIENT_ID,
    'aortic_aneurysm'                AS suspect_group,
    'I71'                            AS suspect_icd10_code,
    'Aortic aneurysm (suspected)'    AS suspect_icd10_short_description,

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
    c.DATA_SOURCE,

    /* trailing Obs fields as NULL to align UNION schema */
    NULL AS LOINC_CODE,
    NULL AS LOINC_DISPLAY,
    NULL AS RESULT,
    NULL AS UNITS
  FROM aa_proc_clean c
  WHERE
    UPPER(c.REASON_SNOMED_CODE) IN (
      '67362008',   -- Aortic aneurysm (disorder)
      '233985008',  -- Abdominal aortic aneurysm (disorder)
      '433068007',  -- Aneurysm of thoracic aorta (disorder)
      '74883004'    -- Thoracic aortic aneurysm without rupture (disorder)
    )
    OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%ANEURYS%'
    OR UPPER(c.SNOMED_DISPLAY)        LIKE '%ANEURYS%'
    OR UPPER(c.NOTE_TEXT)             LIKE '%ANEURYS%'
),

/* -------------------------
   SUSPECT 2: Procedure — repairs (EVAR/TEVAR) are aneurysm-specific
   ------------------------- */
aa_proc_repairs AS (
  SELECT
    r.PATIENT_ID,
    'aortic_aneurysm'                AS suspect_group,
    'I71'                            AS suspect_icd10_code,
    'Aortic aneurysm (suspected)'    AS suspect_icd10_short_description,

    r.resource_id,
    r.resource_type,
    r.status,
    r.obs_date,
    r.CPT_CODE,
    r.CPT_DISPLAY,
    r.SNOMED_CODE,
    r.SNOMED_DISPLAY,
    r.bodysite_snomed_code,
    r.bodysite_snomed_display,
    r.REASON_SNOMED_CODE,
    r.REASON_SNOMED_DISPLAY,
    r.NOTE_TEXT,
    r.DATA_SOURCE,

    /* trailing Obs fields as NULL to align UNION schema */
    NULL AS LOINC_CODE,
    NULL AS LOINC_DISPLAY,
    NULL AS RESULT,
    NULL AS UNITS
  FROM raw_repair r
  WHERE NOT EXISTS (
    SELECT 1 FROM aortic_aneurysm_dx_exclusion x WHERE x.PATIENT_ID = r.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT 3: Observation "document" rows with aneurysm context
   ------------------------- */
aa_obs_doc_suspects AS (
  SELECT
    o.PATIENT_ID,
    'aortic_aneurysm'                AS suspect_group,
    'I71'                            AS suspect_icd10_code,
    'Aortic aneurysm (suspected)'    AS suspect_icd10_short_description,

    o.resource_id,
    o.resource_type,
    o.status,
    o.obs_date,
    /* procedure-oriented slots NULL for obs rows */
    NULL AS CPT_CODE,
    NULL AS CPT_DISPLAY,
    NULL AS SNOMED_CODE,
    NULL AS SNOMED_DISPLAY,
    NULL AS bodysite_snomed_code,
    NULL AS bodysite_snomed_display,
    NULL AS REASON_SNOMED_CODE,
    NULL AS REASON_SNOMED_DISPLAY,
    o.NOTE_TEXT,
    o.DATA_SOURCE,

    /* obs fields */
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS
  FROM obs_docs_clean o
  WHERE
    UPPER(o.LOINC_DISPLAY) LIKE '%AORTA%'
    AND (
      UPPER(o.NOTE_TEXT) LIKE '%ANEURYS%'
      OR UPPER(o.BODYSITE_SNOMED_CT_DISPLAY) LIKE '%AORTA%'
    )
),

/* -------------------------
   SUSPECT 4: Observation measurement (AAA ≥ 3.0 cm, result normalized to cm)
   ------------------------- */
aa_obs_meas_aaa AS (
  SELECT
    m.PATIENT_ID,
    'aortic_aneurysm'                AS suspect_group,
    'I71'                            AS suspect_icd10_code,
    'Aortic aneurysm (suspected)'    AS suspect_icd10_short_description,

    m.resource_id,
    m.resource_type,
    m.status,
    m.obs_date,
    /* procedure-oriented slots NULL */
    NULL AS CPT_CODE,
    NULL AS CPT_DISPLAY,
    NULL AS SNOMED_CODE,
    NULL AS SNOMED_DISPLAY,
    NULL AS bodysite_snomed_code,
    NULL AS bodysite_snomed_display,
    NULL AS REASON_SNOMED_CODE,
    NULL AS REASON_SNOMED_DISPLAY,
    m.NOTE_TEXT,
    m.DATA_SOURCE,

    /* obs fields */
    m.LOINC_CODE,
    m.LOINC_DISPLAY,
    /* emit normalized cm value as RESULT to feed FHIR valueQuantity cleanly */
    TO_VARCHAR(m.diameter_cm) AS RESULT,
    'cm'                      AS UNITS
  FROM (
    SELECT
      o.*,
      IFF(TRY_TO_NUMBER(o.RESULT) IS NULL, NULL,
          CASE
            WHEN UPPER(o.UNITS) IN ('CM','CM.','CENTIMETER','CENTIMETERS') THEN TRY_TO_NUMBER(o.RESULT)
            WHEN UPPER(o.UNITS) IN ('MM','MM.','MILLIMETER','MILLIMETERS') THEN TRY_TO_NUMBER(o.RESULT) / 10.0
            ELSE NULL
          END
      ) AS diameter_cm
    FROM obs_meas_clean o
  ) m
  WHERE
    m.diameter_cm IS NOT NULL
    AND m.diameter_cm >= 3.0
    AND (
      UPPER(m.LOINC_DISPLAY) LIKE '%ABDOM%'
      OR UPPER(m.NOTE_TEXT) LIKE '%ABDOM%'
      OR UPPER(m.BODYSITE_SNOMED_CT_DISPLAY) LIKE '%ABDOMINAL%'
    )
),

/* -------------------------
   UNION ALL SUSPECT EVIDENCE (22-column canonical projection)
   ------------------------- */
aa_suspects_all AS (
  SELECT * FROM aa_proc_context
  UNION ALL
  SELECT * FROM aa_proc_repairs
  UNION ALL
  SELECT * FROM aa_obs_doc_suspects
  UNION ALL
  SELECT * FROM aa_obs_meas_aaa
),

/* -------------------------
   FHIR: build Procedure and Observation evidence separately
   ------------------------- */
aa_with_fhir_procedure AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    'Procedure' AS resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'completed'),
      'code', OBJECT_CONSTRUCT(
        'text',   COALESCE(NULLIF(s.CPT_DISPLAY,''), NULLIF(s.SNOMED_DISPLAY,'')),
        'coding', ARRAY_CONSTRUCT_COMPACT(
          IFF(s.CPT_CODE IS NOT NULL AND s.CPT_CODE <> '',
            OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',s.CPT_CODE,'display',NULLIF(s.CPT_DISPLAY,'')),
            NULL
          ),
          IFF(s.SNOMED_CODE IS NOT NULL AND s.SNOMED_CODE <> '',
            OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',s.SNOMED_CODE,'display',NULLIF(s.SNOMED_DISPLAY,'')),
            NULL
          )
        )
      ),
      'bodySite', IFF(s.bodysite_snomed_code IS NOT NULL AND s.bodysite_snomed_code <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(s.bodysite_snomed_display,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',s.bodysite_snomed_code,'display',NULLIF(s.bodysite_snomed_display,''))
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
              OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',s.REASON_SNOMED_CODE,'display',NULLIF(s.REASON_SNOMED_DISPLAY,''))
            )
          )
        ),
        NULL
      ),
      'note', IFF(s.NOTE_TEXT IS NOT NULL AND s.NOTE_TEXT <> '', ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('text', s.NOTE_TEXT)), NULL),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM aa_suspects_all s
  WHERE s.resource_type = 'Procedure'
),

aa_with_fhir_observation AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    'Observation' AS resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'final'),
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',s.LOINC_CODE,'display',NULLIF(s.LOINC_DISPLAY,''))
        )
      ),
      'valueQuantity', IFF(TRY_TO_NUMBER(s.RESULT) IS NOT NULL,
        OBJECT_CONSTRUCT('value', TRY_TO_NUMBER(s.RESULT), 'unit', NULLIF(s.UNITS,'')),
        NULL
      ),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM aa_suspects_all s
  WHERE s.resource_type = 'Observation'
),

aa_with_fhir_all AS (
  SELECT * FROM aa_with_fhir_procedure
  UNION ALL
  SELECT * FROM aa_with_fhir_observation
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
FROM aa_with_fhir_all
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
