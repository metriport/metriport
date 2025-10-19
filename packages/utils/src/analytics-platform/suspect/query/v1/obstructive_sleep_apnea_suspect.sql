/* ============================================================
   OBSTRUCTIVE SLEEP APNEA — SUSPECT QUERY (Procedures + EXCLUSIONS) — NEW SCHEMAS
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence consistent with OSA from sleep
     study / PAP-related procedures, while EXCLUDING patients
     with potential confounders (heart failure or ARDS).
   ============================================================ */

WITH osa_dx_exclusion AS (
  -- Exclude patients with confounding conditions that often lead to PAP use
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'I50%'   -- Heart failure
     OR c.ICD_10_CM_CODE LIKE 'J80%'   -- ARDS
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
osa_raw AS (
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
    '95810',  -- Polysomnography (attended PSG)
    '95811',  -- Polysomnography with CPAP/BiPAP titration (attended)
    '95800',  -- Sleep study, unattended (Type II HST)
    '95806',  -- Sleep study, unattended (Type III HST)
    '95807',  -- Polysomnography (attended, limited channels)
    'G0399',  -- Home sleep test (HST), Type III, unattended (≥4 parameters)
    'G0400',  -- Home sleep test (HST), Type IV, unattended (≥3 parameters)
    'E0601',  -- CPAP device (continuous positive airway pressure)
    '94660'   -- CPAP initiation and management
  )
),

/* -------------------------
   NORM: (no normalization) pass-through
   ------------------------- */
osa_norm AS (
  SELECT * FROM osa_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
osa_clean AS (
  SELECT *
  FROM osa_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM osa_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: map codes to OSA evidence buckets
   ------------------------- */
osa_suspects AS (
  SELECT
    c.PATIENT_ID,

    CASE
      WHEN c.code IN (
        '95810',  -- Polysomnography (attended PSG)
        '95811',  -- Polysomnography with CPAP/BiPAP titration (attended)
        '95800',  -- Sleep study, unattended (Type II HST)
        '95806',  -- Sleep study, unattended (Type III HST)
        '95807',  -- Polysomnography (attended, limited channels)
        'G0399',  -- Home sleep test (HST), Type III, unattended (≥4 parameters)
        'G0400'   -- Home sleep test (HST), Type IV, unattended (≥3 parameters)
      ) THEN 'osa_sleep_study'
      WHEN c.code IN (
        'E0601',  -- CPAP device (continuous positive airway pressure)
        '94660'   -- CPAP initiation and management
      ) THEN 'osa_pap_treatment'
      ELSE NULL
    END AS suspect_group,

    'G47.33' AS suspect_icd10_code,
    'Obstructive sleep apnea (adult) (pediatric)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.code,
    c.display,
    c.obs_date,
    c.DATA_SOURCE
  FROM osa_clean c
  WHERE c.code IN (
    '95810',  -- Polysomnography (attended PSG)
    '95811',  -- Polysomnography with CPAP/BiPAP titration (attended)
    '95800',  -- Sleep study, unattended (Type II HST)
    '95806',  -- Sleep study, unattended (Type III HST)
    '95807',  -- Polysomnography (attended, limited channels)
    'G0399',  -- Home sleep test (HST), Type III, unattended (≥4 parameters)
    'G0400',  -- Home sleep test (HST), Type IV, unattended (≥3 parameters)
    'E0601',  -- CPAP device (continuous positive airway pressure)
    '94660'   -- CPAP initiation and management
  )
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
osa_with_fhir AS (
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
  FROM osa_suspects s
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
FROM osa_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
