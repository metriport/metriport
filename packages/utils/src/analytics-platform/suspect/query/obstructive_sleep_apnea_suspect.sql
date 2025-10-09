/* ============================================================
   OBSTRUCTIVE SLEEP APNEA — SUSPECT QUERY (Procedures + EXCLUSIONS)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence consistent with OSA from sleep
     study / PAP-related procedures, while EXCLUDING patients
     with potential confounders (heart failure or ARDS).

   Evidence (PROCEDURE.NORMALIZED_CODE in):
     • Sleep studies / HST: 95810, 95811, 95800, 95806, 95807, G0399, G0400
     • PAP device / CPAP management: E0601, 94660

   Dx Exclusions (confounders):
     • Heart failure: I50.*
     • Acute respiratory distress syndrome (ARDS): J80.*
   ============================================================ */

WITH osa_dx_exclusion AS (
  -- Exclude patients with confounding conditions that often lead to PAP use
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND (
      c.NORMALIZED_CODE LIKE 'I50%'   -- Heart failure
      OR c.NORMALIZED_CODE LIKE 'J80%' -- ARDS
    )
),

/* -------------------------
   RAW: pull procedure rows
   ------------------------- */
osa_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID        AS resource_id,
    'Procedure'           AS resource_type,
    p.NORMALIZED_CODE,
    p.NORMALIZED_DESCRIPTION,
    CAST(p.PROCEDURE_DATE AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE p.NORMALIZED_CODE IN (
    '95810','95811','95800','95806','95807',  -- polysomnography / sleep studies
    'G0399','G0400',                          -- home sleep testing HCPCS
    'E0601','94660'                           -- PAP device / CPAP initiation/management
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
      WHEN c.NORMALIZED_CODE IN ('95810','95811','95800','95806','95807','G0399','G0400')
        THEN 'osa_sleep_study'
      WHEN c.NORMALIZED_CODE IN ('E0601','94660')
        THEN 'osa_pap_treatment'
    END AS suspect_group,

    'G47.33' AS suspect_icd10_code,
    'Obstructive sleep apnea (adult) (pediatric)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.obs_date,
    c.DATA_SOURCE
  FROM osa_clean c
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
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.obs_date,
    s.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'performedDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
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
