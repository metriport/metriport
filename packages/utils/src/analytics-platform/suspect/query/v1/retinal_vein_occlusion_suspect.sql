/* ============================================================
   RETINAL VEIN OCCLUSION (RVO) — SUSPECT QUERY
   Strong rule: (FA OR OCT/OCTA) AND intravitreal injection
   + Support: include intravitreal anti-VEGF meds specific to RVO
              (aflibercept 2 mg, ranibizumab 0.5 mg)
   Exclusion: existing retinal vascular occlusion (H348*)
   Cast-safe: RxNorm/SNOMED comparisons as VARCHAR
   ============================================================ */

WITH rvo_dx_exclusion AS (
  /* Patients already diagnosed with retinal vascular occlusion (dotless ICD-10) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'H348%'
),

/* -------------------------
   RAW: pull all candidate procedures (codes only)
   ------------------------- */
rvo_proc_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                              AS resource_id,
    'Procedure'                                 AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed')  AS status,
    COALESCE(p.PERFORMED_DATE, p.END_DATE)      AS obs_date,

    /* procedure coding slots */
    UPPER(p.CPT_CODE)    AS CPT_CODE,
    p.CPT_DISPLAY        AS CPT_DISPLAY,
    UPPER(p.SNOMED_CODE) AS SNOMED_CODE,
    p.SNOMED_DISPLAY     AS SNOMED_DISPLAY,

    /* context/body site if available */
    p.BODYSITE_SNOMED_CODE     AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,

    p.DATA_SOURCE
  FROM CORE_V3.PROCEDURE p
  WHERE
    (
      /* Imaging: fundus, FA, OCT/OCTA (CPT) */
      UPPER(p.CPT_CODE) IN (
        '92250',  -- Fundus photography
        '92227',  -- Remote retinal imaging, unilateral/bilateral
        '92228',  -- Remote retinal imaging with report
        '92235',  -- Fluorescein angiography (FA)
        '92134',  -- OCT retina
        '92137'   -- OCT angiography
      )
      OR
      /* Injection: intravitreal (CPT) */
      UPPER(p.CPT_CODE) IN ('67028')   -- Intravitreal injection of pharmacologic agent
    )
    AND TO_VARCHAR(p.REASON_SNOMED_CODE) IN (
      '786050007',  -- Occlusion of branch of retinal vein of right eye
      '786049007',  -- Occlusion of branch of retinal vein of left eye
      '24596005',   -- Venous retinal branch occlusion
      '232039004',  -- Central retinal vein occlusion with macular edema
      '232048009'   -- Branch retinal vein occlusion with macular edema
    )
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
rvo_proc_norm AS (
  SELECT * FROM rvo_proc_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusion
   ------------------------- */
rvo_proc_clean AS (
  SELECT *
  FROM rvo_proc_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM rvo_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT — build the “strong” rule:
   (FA OR OCT) AND (67028), any dates
   ------------------------- */
img_patients AS (
  SELECT DISTINCT PATIENT_ID
  FROM rvo_proc_clean
  WHERE CPT_CODE IN ('92235','92134','92137')  -- FA or OCT/OCTA
),
tx_patients AS (
  SELECT DISTINCT PATIENT_ID
  FROM rvo_proc_clean
  WHERE CPT_CODE = '67028'                     -- Intravitreal injection
),
patients_strong AS (
  SELECT i.PATIENT_ID
  FROM img_patients i
  INNER JOIN tx_patients t USING (PATIENT_ID)
),

/* Collect all supporting procedures for qualified patients,
   including fundus imaging as supporting if present */
rvo_supporting AS (
  SELECT *
  FROM rvo_proc_clean c
  WHERE c.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_strong)
    AND c.CPT_CODE IN ('92235','92134','92137','67028','92250','92227','92228')
),

/* -------------------------
   SUSPECT projection (canonical columns)
   ------------------------- */
rvo_proc_suspects AS (
  SELECT
    s.PATIENT_ID,
    'rvo_imaging_plus_injection'              AS suspect_group,
    'H34.8'                                   AS suspect_icd10_code,
    'Other retinal vascular occlusions (suspected RVO)' AS suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.status,
    s.obs_date,
    s.CPT_CODE,
    s.CPT_DISPLAY,
    s.SNOMED_CODE,
    s.SNOMED_DISPLAY,
    s.bodysite_snomed_code,
    s.bodysite_snomed_display,
    s.REASON_SNOMED_CODE,
    s.REASON_SNOMED_DISPLAY,
    s.NOTE_TEXT,
    s.DATA_SOURCE,

    /* trailing Obs fields kept for UNION compatibility (NULL here) */
    NULL AS LOINC_CODE,
    NULL AS LOINC_DISPLAY,
    NULL AS RESULT,
    NULL AS UNITS
  FROM rvo_supporting s
),

/* -------------------------
   MEDICATION SUPPORT (anti-VEGF specific to RVO)
   Whitelist: aflibercept 2 mg; ranibizumab 0.5 mg (incl. biosimilar)
   ------------------------- */
rvo_med_whitelist AS (
  SELECT column1::varchar AS RXNORM_CODE
  FROM VALUES
    /* Aflibercept 2 mg */
    ('1232159'), -- EYLEA 2 MG in 0.05 ML Injection
    ('2693567'), -- EYLEA 2 MG in 0.05 ML Prefilled Syringe
    ('1232154'), -- aflibercept 2 MG in 0.05 ML Injection
    ('2693564'), -- aflibercept 2 MG in 0.05 ML Prefilled Syringe
    /* Ranibizumab 0.5 mg (incl. ranibizumab-nuna) */
    ('643193'),  -- ranibizumab 0.5 MG in 0.05 ML Injection
    ('1864423'), -- ranibizumab 0.5 MG in 0.05 ML Prefilled Syringe
    ('2602353')  -- ranibizumab-nuna 0.5 MG in 0.05 ML Injection
),
rvo_meds_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                         AS resource_id,
    'MedicationRequest'                              AS resource_type,
    COALESCE(NULLIF(mr.STATUS,''), 'active')         AS status,
    mr.AUTHORED_ON                                   AS obs_date,
    TO_VARCHAR(m.RXNORM_CODE)                        AS RXNORM_CODE,
    m.RXNORM_DISPLAY,
    mr.DATA_SOURCE
  FROM CORE_V3.MEDICATION_REQUEST mr
  JOIN CORE_V3.MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  JOIN rvo_med_whitelist w
    ON TO_VARCHAR(m.RXNORM_CODE) = w.RXNORM_CODE
  WHERE mr.PATIENT_ID IN (SELECT PATIENT_ID FROM patients_strong)
),
rvo_meds_clean AS (
  SELECT *
  FROM rvo_meds_raw r
  WHERE NOT EXISTS (SELECT 1 FROM rvo_dx_exclusion x WHERE x.PATIENT_ID = r.PATIENT_ID)
    AND NULLIF(r.RXNORM_DISPLAY,'') IS NOT NULL
    AND NULLIF(r.DATA_SOURCE,'') IS NOT NULL
),
rvo_meds_with_fhir AS (
  SELECT
    r.PATIENT_ID,
    'rvo_rx'                                            AS suspect_group,
    'H34.8'                                             AS suspect_icd10_code,
    'Other retinal vascular occlusions (suspected RVO)' AS suspect_icd10_short_description,

    r.resource_id,
    'MedicationRequest' AS resource_type,
    r.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','MedicationRequest',
      'id',            r.resource_id,
      'status',        r.status,
      'intent',        'order',
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'text',   NULLIF(r.RXNORM_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system','http://www.nlm.nih.gov/research/umls/rxnorm',
            'code',  r.RXNORM_CODE,
            'display', NULLIF(r.RXNORM_DISPLAY,'')
          )
        )
      ),
      'authoredOn', IFF(r.obs_date IS NOT NULL, TO_CHAR(r.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM rvo_meds_clean r
),

/* -------------------------
   FHIR for procedures
   ------------------------- */
rvo_proc_with_fhir AS (
  SELECT
    u.PATIENT_ID,
    u.suspect_group,
    u.suspect_icd10_code,
    u.suspect_icd10_short_description,

    u.resource_id,
    'Procedure' AS resource_type,
    u.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            u.resource_id,
      'status',        COALESCE(NULLIF(u.status,''), 'completed'),
      'code', OBJECT_CONSTRUCT(
        'text',   COALESCE(NULLIF(u.CPT_DISPLAY,''), NULLIF(u.SNOMED_DISPLAY,'')),
        'coding', ARRAY_CONSTRUCT_COMPACT(
          IFF(u.CPT_CODE   IS NOT NULL AND u.CPT_CODE   <> '',
              OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',u.CPT_CODE,'display',NULLIF(u.CPT_DISPLAY,'')),
              NULL),
          IFF(u.SNOMED_CODE IS NOT NULL AND u.SNOMED_CODE <> '',
              OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',u.SNOMED_CODE,'display',NULLIF(u.SNOMED_DISPLAY,'')),
              NULL)
        )
      ),
      'bodySite', IFF(u.bodysite_snomed_code IS NOT NULL AND u.bodysite_snomed_code <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(u.bodysite_snomed_display,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',u.bodysite_snomed_code,'display',NULLIF(u.bodysite_snomed_display,''))
            )
          )
        ),
        NULL
      ),
      'reasonCode', IFF(u.REASON_SNOMED_CODE IS NOT NULL AND u.REASON_SNOMED_CODE <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(u.REASON_SNOMED_DISPLAY,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',u.REASON_SNOMED_CODE,'display',NULLIF(u.REASON_SNOMED_DISPLAY,''))
            )
          )
        ),
        NULL
      ),
      'note', IFF(u.NOTE_TEXT IS NOT NULL AND u.NOTE_TEXT <> '', ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('text', u.NOTE_TEXT)), NULL),
      'effectiveDateTime', IFF(u.obs_date IS NOT NULL, TO_CHAR(u.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM rvo_proc_suspects u
),

/* -------------------------
   UNION procedures + meds
   ------------------------- */
rvo_all_with_fhir AS (
  SELECT * FROM rvo_proc_with_fhir
  UNION ALL
  SELECT * FROM rvo_meds_with_fhir
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
FROM rvo_all_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
