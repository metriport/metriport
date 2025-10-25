/* ============================================================
   ARRHYTHMIA — SUSPECT QUERY
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Flag likely cardiac arrhythmia when ANY of the following hold:
       1) EKG finding evidence (arrhythmia indicated in ECG result/note),
       2) Definitive treatment/procedure (cardioversion or ILR),
       3) Anti-arrhythmic medications:
            • Class I/III (quinidine, procainamide, flecainide, propafenone,
              lidocaine, amiodarone, sotalol, dofetilide) → standalone evidence
            • Class II/IV (propranolol, metoprolol, atenolol, verapamil, diltiazem)
              → SUPPORTIVE ONLY, require objective evidence within ±90 days

   Dx Exclusion (ICD-10-CM): I47.*, I48.*, I49.*

   Data sources (new schemas)
     • CONDITION
     • PROCEDURE
     • OBSERVATION
     • CORE_V3.MEDICATION_REQUEST
     • CORE_V3.MEDICATION

   Definitive procedure evidence (CPT):
     • 92960  External electrical cardioversion
     • 92961  Internal electrical cardioversion
     • 33285  Insertion of subcutaneous cardiac rhythm monitor (ILR)
     • 33286  Removal of subcutaneous cardiac rhythm monitor (ILR)

   ECG procedure (reason-supported; optional path):
     • 93000  Electrocardiogram, complete
     • 93005  Electrocardiogram, tracing only
     • 93010  Electrocardiogram, interpretation and report

   EKG text signals (examples; case-insensitive):
     atrial fibrillation|a-fib|afib|atrial flutter|svt|supraventricular tachycardia|
     vt|ventricular tachycardia|vf|ventricular fibrillation|junctional rhythm|
     av block|atrioventricular block|mobitz|complete heart block|sick sinus|
     sinus pause|pvc|pvcs|pac|pacs

   Negation guards (examples; case-insensitive):
     'no evidence of', 'without', 'normal sinus', 'nsr', 'no arrhythmia'
   ============================================================ */

WITH
arrhythmia_dx_exclusion AS (
  /* Existing arrhythmia diagnosis → exclude (I47.*, I48.*, I49.*) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'I47%'
     OR c.ICD_10_CM_CODE LIKE 'I48%'
     OR c.ICD_10_CM_CODE LIKE 'I49%'
),

/* ------------------------------------------------------------
   1) DEFINITIVE PROCEDURE EVIDENCE (cardioversion / ILR)
   ------------------------------------------------------------ */
proc_definitive_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                              AS resource_id,
    'Procedure'                                 AS resource_type,
    p.CPT_CODE                                  AS code,
    p.CPT_DISPLAY                               AS display,
    CAST(p.PERFORMED_DATE AS DATE)                  AS ev_date,
    p.DATA_SOURCE
  FROM CORE_V3.PROCEDURE p
  WHERE p.CPT_CODE IN (
    '92960',  -- External electrical cardioversion
    '92961',  -- Internal electrical cardioversion
    '33285',  -- Insertion subcutaneous cardiac rhythm monitor (ILR)
    '33286'   -- Removal subcutaneous cardiac rhythm monitor (ILR)
  )
    AND NULLIF(p.CPT_DISPLAY,'') IS NOT NULL
),
proc_definitive_clean AS (
  SELECT r.*
  FROM proc_definitive_raw r
  LEFT JOIN arrhythmia_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* ------------------------------------------------------------
   2) EKG FINDING EVIDENCE (Observation text or ECG proc + reason)
   ------------------------------------------------------------ */
ekg_obs_raw AS (
  /* ECG observations: look for arrhythmia terms in RESULT/NOTE_TEXT with simple negation guards */
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                           AS resource_id,
    'Observation'                              AS resource_type,
    o.LOINC_CODE                               AS code,
    o.LOINC_DISPLAY                            AS display,
    CAST(o.EFFECTIVE_DATE AS DATE)             AS ev_date,
    o.VALUE                                    AS RESULT,
    o.NOTE_TEXT,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE
    (
      UPPER(o.LOINC_DISPLAY) LIKE '%ELECTROCARDIOGRAM%'
      OR UPPER(o.LOINC_DISPLAY) LIKE '%ECG%'
      OR UPPER(o.LOINC_DISPLAY) LIKE '%EKG%'
      OR UPPER(o.CATEGORY_HL7_DISPLAY) LIKE '%ELECTROCARDIOGRAM%'
    )
    AND (
      (o.VALUE   ILIKE '%atrial fibrillation%' OR o.VALUE   ILIKE '%a-fib%' OR o.VALUE   ILIKE '%afib%'
       OR o.VALUE ILIKE '%atrial flutter%'     OR o.VALUE   ILIKE '%svt%'   OR o.VALUE   ILIKE '%supraventricular tachycardia%'
       OR o.VALUE ILIKE '%ventricular tachycardia%' OR o.VALUE ILIKE '%vt%' OR o.VALUE   ILIKE '%ventricular fibrillation%' OR o.VALUE ILIKE '%vf%'
       OR o.VALUE ILIKE '%junctional rhythm%'  OR o.VALUE   ILIKE '%av block%' OR o.VALUE ILIKE '%atrioventricular block%'
       OR o.VALUE ILIKE '%mobitz%'             OR o.VALUE   ILIKE '%complete heart block%'
       OR o.VALUE ILIKE '%sick sinus%'         OR o.VALUE   ILIKE '%sinus pause%'
       OR o.VALUE ILIKE '%pvc%'                OR o.VALUE   ILIKE '%pvcs%'  OR o.VALUE   ILIKE '%pac%' OR o.VALUE ILIKE '%pacs%')
      OR
      (o.NOTE_TEXT ILIKE '%atrial fibrillation%' OR o.NOTE_TEXT ILIKE '%a-fib%' OR o.NOTE_TEXT ILIKE '%afib%'
       OR o.NOTE_TEXT ILIKE '%atrial flutter%'   OR o.NOTE_TEXT ILIKE '%svt%'   OR o.NOTE_TEXT ILIKE '%supraventricular tachycardia%'
       OR o.NOTE_TEXT ILIKE '%ventricular tachycardia%' OR o.NOTE_TEXT ILIKE '%vt%' OR o.NOTE_TEXT ILIKE '%ventricular fibrillation%' OR o.NOTE_TEXT ILIKE '%vf%'
       OR o.NOTE_TEXT ILIKE '%junctional rhythm%' OR o.NOTE_TEXT ILIKE '%av block%' OR o.NOTE_TEXT ILIKE '%atrioventricular block%'
       OR o.NOTE_TEXT ILIKE '%mobitz%'           OR o.NOTE_TEXT ILIKE '%complete heart block%'
       OR o.NOTE_TEXT ILIKE '%sick sinus%'       OR o.NOTE_TEXT ILIKE '%sinus pause%'
       OR o.NOTE_TEXT ILIKE '%pvc%'              OR o.NOTE_TEXT ILIKE '%pvcs%'  OR o.NOTE_TEXT ILIKE '%pac%' OR o.NOTE_TEXT ILIKE '%pacs%')
    )
    AND (
      (o.VALUE    IS NULL OR (
         o.VALUE NOT ILIKE '%no evidence of%'
     AND o.VALUE NOT ILIKE '%without%'
     AND o.VALUE NOT ILIKE '%normal sinus%'
     AND o.VALUE NOT ILIKE '%nsr%'
     AND o.VALUE NOT ILIKE '%no arrhythmia%'))
      AND
      (o.NOTE_TEXT IS NULL OR (
         o.NOTE_TEXT NOT ILIKE '%no evidence of%'
     AND o.NOTE_TEXT NOT ILIKE '%without%'
     AND o.NOTE_TEXT NOT ILIKE '%normal sinus%'
     AND o.NOTE_TEXT NOT ILIKE '%nsr%'
     AND o.NOTE_TEXT NOT ILIKE '%no arrhythmia%'))
    )
),
ekg_obs_clean AS (
  SELECT r.*
  FROM ekg_obs_raw r
  LEFT JOIN arrhythmia_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* ECG procedure with arrhythmia reason */
ecg_proc_reason_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                              AS resource_id,
    'Procedure'                                 AS resource_type,
    p.CPT_CODE                                  AS code,
    p.CPT_DISPLAY                               AS display,
    CAST(p.PERFORMED_DATE AS DATE)                  AS ev_date,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.DATA_SOURCE
  FROM CORE_V3.PROCEDURE p
  WHERE p.CPT_CODE IN (
    '93000',  -- Electrocardiogram, complete
    '93005',  -- Electrocardiogram, tracing only
    '93010'   -- Electrocardiogram, interpretation and report
  )
  AND (
    p.REASON_SNOMED_DISPLAY ILIKE '%atrial fibrillation%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%atrial flutter%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%supraventricular tachycardia%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%ventricular tachycardia%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%ventricular fibrillation%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%junctional rhythm%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%atrioventricular block%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%av block%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%mobitz%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%complete heart block%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%sick sinus%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%sinus pause%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%premature ventricular%'
    OR p.REASON_SNOMED_DISPLAY ILIKE '%premature atrial%'
  )
),
ecg_proc_reason_clean AS (
  SELECT r.*
  FROM ecg_proc_reason_raw r
  LEFT JOIN arrhythmia_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* ------------------------------------------------------------
   3) MEDICATION EVIDENCE — via MEDICATION_REQUEST + MEDICATION
   ------------------------------------------------------------ */

/* Class I / III anti-arrhythmics (standalone) */
med_antiarrhythmic_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                    AS resource_id,
    'MedicationRequest'                         AS resource_type,
    m.RXNORM_CODE                               AS code,
    COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)   AS display,
    CAST(mr.AUTHORED_ON AS DATE)                AS ev_date,
    mr.STATUS                                   AS req_status,
    mr.DATA_SOURCE
  FROM CORE_V3.MEDICATION_REQUEST mr
  JOIN CORE_V3.MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE mr.AUTHORED_ON IS NOT NULL
    AND (
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%quinidine%'     OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%procainamide%'  OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%flecainide%'    OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%propafenone%'   OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%amiodarone%'    OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%sotalol%'       OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%dofetilide%'    OR
      /* common brands */
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%tikosyn%'   OR  -- dofetilide
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%rythmol%'   OR  -- propafenone
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%tambocor%'  OR  -- flecainide
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%pacerone%'  OR  -- amiodarone
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%cordarone%' OR  -- amiodarone
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%betapace%'      -- sotalol
    )
),
med_antiarrhythmic_clean AS (
  SELECT r.*
  FROM med_antiarrhythmic_raw r
  LEFT JOIN arrhythmia_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),

/* Class II/IV — supportive only. Require objective evidence (EKG finding OR definitive procedure) within ±90 days. */
objective_evidence AS (
  SELECT PATIENT_ID, ev_date FROM ekg_obs_clean
  UNION ALL
  SELECT PATIENT_ID, ev_date FROM ecg_proc_reason_clean
  UNION ALL
  SELECT PATIENT_ID, ev_date FROM proc_definitive_clean
),
med_beta_ccb_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                    AS resource_id,
    'MedicationRequest'                         AS resource_type,
    m.RXNORM_CODE                               AS code,
    COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)   AS display,
    CAST(mr.AUTHORED_ON AS DATE)                AS med_date,
    mr.STATUS                                   AS req_status,
    mr.DATA_SOURCE
  FROM CORE_V3.MEDICATION_REQUEST mr
  JOIN CORE_V3.MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE mr.AUTHORED_ON IS NOT NULL
    AND (
      /* Beta blockers */
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%propranolol%' OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%metoprolol%'  OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%atenolol%'    OR
      /* Non-DHP CCBs */
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%verapamil%'   OR
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE '%diltiazem%'
    )
),
med_beta_ccb_supported AS (
  SELECT DISTINCT
    b.PATIENT_ID,
    b.resource_id,
    b.resource_type,
    b.code,
    b.display,
    /* use the medication date as the event date for FHIR */
    b.med_date AS ev_date,
    b.req_status,
    b.DATA_SOURCE
  FROM med_beta_ccb_raw b
  LEFT JOIN arrhythmia_dx_exclusion x
    ON x.PATIENT_ID = b.PATIENT_ID
  LEFT JOIN objective_evidence e
    ON e.PATIENT_ID = b.PATIENT_ID
   AND e.ev_date BETWEEN DATEADD('day', -90, b.med_date) AND DATEADD('day',  90, b.med_date)
  WHERE x.PATIENT_ID IS NULL
    AND e.PATIENT_ID IS NOT NULL
),

/* ------------------------------------------------------------
   SUSPECT GROUPS
   ------------------------------------------------------------ */
suspects_ekg_obs AS (
  SELECT
    o.PATIENT_ID,
    'arrhythmia_ekg_evidence'                         AS suspect_group,
    'I49.9'                                           AS suspect_icd10_code,
    'Cardiac arrhythmia, unspecified (EKG finding)'   AS suspect_icd10_short_description,
    o.resource_id, o.resource_type, o.code, o.display, o.ev_date, o.DATA_SOURCE
  FROM ekg_obs_clean o
),
suspects_ekg_proc_reason AS (
  SELECT
    p.PATIENT_ID,
    'arrhythmia_ekg_evidence'                         AS suspect_group,
    'I49.9'                                           AS suspect_icd10_code,
    'Cardiac arrhythmia, unspecified (ECG proc + reason)' AS suspect_icd10_short_description,
    p.resource_id, p.resource_type, p.code, p.display, p.ev_date, p.DATA_SOURCE
  FROM ecg_proc_reason_clean p
),
suspects_procedure_definitive AS (
  SELECT
    p.PATIENT_ID,
    'arrhythmia_procedure_evidence'                   AS suspect_group,
    'I49.9'                                           AS suspect_icd10_code,
    'Cardiac arrhythmia, unspecified (procedure evidence)' AS suspect_icd10_short_description,
    p.resource_id, p.resource_type, p.code, p.display, p.ev_date, p.DATA_SOURCE
  FROM proc_definitive_clean p
),
suspects_med_antiarrhythmic AS (
  SELECT
    m.PATIENT_ID,
    'arrhythmia_med_antiarrhythmic'                   AS suspect_group,
    'I49.9'                                           AS suspect_icd10_code,
    'Cardiac arrhythmia, unspecified (anti-arrhythmic treatment)' AS suspect_icd10_short_description,
    m.resource_id, m.resource_type, m.code, m.display, m.ev_date, m.DATA_SOURCE
  FROM med_antiarrhythmic_clean m
),
suspects_med_beta_ccb_supportive AS (
  SELECT
    m.PATIENT_ID,
    'arrhythmia_med_beta_ccb_supportive'              AS suspect_group,
    'I49.9'                                           AS suspect_icd10_code,
    'Cardiac arrhythmia, unspecified (beta/CCB + objective evidence)' AS suspect_icd10_short_description,
    m.resource_id, m.resource_type, m.code, m.display, m.ev_date, m.DATA_SOURCE
  FROM med_beta_ccb_supported m
),

/* ------------------------------------------------------------
   FHIR payloads per evidence type
   ------------------------------------------------------------ */
fhir_obs AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    s.resource_id, s.resource_type, s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','Observation',
      'id', s.resource_id,
      'status','final',
      'code', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',s.code,'display',s.display)
        ),
        'text', s.display
      ),
      'effectiveDateTime', TO_CHAR(s.ev_date,'YYYY-MM-DD')
    ) AS fhir
  FROM suspects_ekg_obs s
),
fhir_proc AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    s.resource_id, s.resource_type, s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','Procedure',
      'id', s.resource_id,
      'status','completed',
      'code', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',s.code,'display',s.display)
        ),
        'text', s.display
      ),
      'effectiveDateTime', TO_CHAR(s.ev_date,'YYYY-MM-DD')
    ) AS fhir
  FROM suspects_ekg_proc_reason s
  UNION ALL
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    s.resource_id, s.resource_type, s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','Procedure',
      'id', s.resource_id,
      'status','completed',
      'code', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',s.code,'display',s.display)
        ),
        'text', s.display
      ),
      'effectiveDateTime', TO_CHAR(s.ev_date,'YYYY-MM-DD')
    ) AS fhir
  FROM suspects_procedure_definitive s
),
fhir_medreq AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    s.resource_id, s.resource_type, s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','MedicationRequest',
      'id', s.resource_id,
      'status','active',
      'intent','order',
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.nlm.nih.gov/research/umls/rxnorm','code',s.code,'display',s.display)
        ),
        'text', s.display
      ),
      'authoredOn', TO_CHAR(s.ev_date,'YYYY-MM-DD')
    ) AS fhir
  FROM suspects_med_antiarrhythmic s
  UNION ALL
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    s.resource_id, s.resource_type, s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','MedicationRequest',
      'id', s.resource_id,
      'status','active',
      'intent','order',
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.nlm.nih.gov/research/umls/rxnorm','code',s.code,'display',s.display)
        ),
        'text', s.display
      ),
      'authoredOn', TO_CHAR(s.ev_date,'YYYY-MM-DD')
    ) AS fhir
  FROM suspects_med_beta_ccb_supportive s
),

/* ------------------------------------------------------------
   UNION ALL evidence w/ FHIR
   ------------------------------------------------------------ */
all_suspects AS (
  SELECT * FROM fhir_obs
  UNION ALL
  SELECT * FROM fhir_proc
  UNION ALL
  SELECT * FROM fhir_medreq
)

/* ------------------------------------------------------------
   RETURN
   ------------------------------------------------------------ */
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
FROM all_suspects
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
