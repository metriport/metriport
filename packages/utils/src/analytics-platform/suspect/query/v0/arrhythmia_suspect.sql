/* ============================================================
   ARRHYTHMIA — SUSPECT QUERY
   (Definitive procedure evidence, with EXCLUSION)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with likely cardiac arrhythmia based on
     **definitive procedures only**, while EXCLUDING patients
     already documented with arrhythmia diagnoses.

   What counts as definitive procedure evidence (PROCEDURE):
     • Cardioversion (electrical)
         - 92960  External electrical cardioversion
         - 92961  Internal electrical cardioversion
     • Insertable loop recorder (ILR) — rhythm monitor device
         - 33285  Insertion of subcutaneous cardiac rhythm monitor
         - 33286  Removal of subcutaneous cardiac rhythm monitor

   Notes
     • Intentionally excludes general ECG/EKG, screening, and
       broad rhythm-monitoring codes to avoid false positives.
     • Evidence is based solely on the procedure records above.

   Dx Exclusion (ICD-10-CM):
     • I47.*  Paroxysmal tachycardia
     • I48.*  Atrial fibrillation & flutter
     • I49.*  Other cardiac arrhythmias
   ============================================================ */

WITH arrhythmia_dx_exclusion AS (
  /* Exclude patients with an existing arrhythmia diagnosis */
  SELECT DISTINCT
    c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND (
      c.NORMALIZED_CODE LIKE 'I47%'  /* Paroxysmal tachycardia */
      OR c.NORMALIZED_CODE LIKE 'I48%'  /* Atrial fib/flutter */
      OR c.NORMALIZED_CODE LIKE 'I49%'  /* Other arrhythmias */
    )
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
arrhythmia_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                                    AS resource_id,
    'Procedure'                                       AS resource_type,
    COALESCE(NULLIF(p.NORMALIZED_CODE_TYPE,''), p.SOURCE_CODE_TYPE) AS code_system_raw,
    p.NORMALIZED_CODE                                 AS normalized_code,
    p.NORMALIZED_DESCRIPTION                          AS normalized_description,
    CAST(p.PROCEDURE_DATE AS DATE)                    AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE
    (
      /* Cardioversion (definitive treatment) */
      p.NORMALIZED_CODE IN (
        '92960',  -- External electrical cardioversion
        '92961'   -- Internal electrical cardioversion
      )

      OR

      /* Insertable loop recorder (ILR) — device evidence */
      p.NORMALIZED_CODE IN (
        '33285',  -- Insertion subcutaneous cardiac rhythm monitor
        '33286'   -- Removal subcutaneous cardiac rhythm monitor
      )
    )
    AND NULLIF(p.NORMALIZED_DESCRIPTION, '') IS NOT NULL
),

/* -------------------------
   NORM: (no normalization needed) pass-through
   ------------------------- */
arrhythmia_norm AS (
  SELECT
    PATIENT_ID,
    resource_id,
    resource_type,
    code_system_raw,
    normalized_code,
    normalized_description,
    obs_date,
    DATA_SOURCE
  FROM arrhythmia_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
arrhythmia_clean AS (
  SELECT
    *
  FROM arrhythmia_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM arrhythmia_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label
   ------------------------- */
arrhythmia_suspects AS (
  SELECT
    c.PATIENT_ID,
    'arrhythmia_procedure_evidence'                  AS suspect_group,
    'I49.9'                                          AS suspect_icd10_code,
    'Cardiac arrhythmia, unspecified (procedure evidence)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.code_system_raw,
    c.normalized_code,
    c.normalized_description,
    c.obs_date,
    c.DATA_SOURCE
  FROM arrhythmia_clean c
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
arrhythmia_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.normalized_code,
    s.normalized_description,
    s.obs_date,
    s.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code',          OBJECT_CONSTRUCT(
                         'text',   NULLIF(s.normalized_description,''),
                         'coding', ARRAY_CONSTRUCT(
                                     OBJECT_CONSTRUCT(
                                       'system',
                                         CASE
                                           WHEN LOWER(s.code_system_raw) = 'cpt'   THEN 'http://www.ama-assn.org/go/cpt'
                                           WHEN LOWER(s.code_system_raw) = 'hcpcs' THEN 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'
                                           WHEN LOWER(s.code_system_raw) = 'snomed-ct' THEN 'http://snomed.info/sct'
                                           WHEN LOWER(s.code_system_raw) = 'loinc' THEN 'http://loinc.org'
                                           ELSE NULL
                                         END,
                                       'code',   s.normalized_code,
                                       'display',s.normalized_description
                                     )
                                   )
                       ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM arrhythmia_suspects s
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
      'resource_type', resource_type,  /* "Procedure" */
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM arrhythmia_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;