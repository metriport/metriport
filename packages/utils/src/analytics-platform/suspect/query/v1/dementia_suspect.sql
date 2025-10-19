/* ============================================================
   DEMENTIA (MoCA-based) — SUSPECT QUERY
   (Observation-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → DAILY_PICK → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with suspected dementia using Montreal Cognitive
     Assessment (MoCA) scores:
       • Primary: MoCA < 18  → moderate–severe impairment
       • Secondary: 18–21    → likely dementia (high specificity)

   Exclusion (diagnosis-based; ICD-10-CM):
     • F01*  Vascular dementia
     • F02*  Dementia in other diseases classified elsewhere
     • F03*  Unspecified dementia
     • G30*  Alzheimer disease

   Notes
     - Uses CORE_V3.CORE__OBSERVATION (LOINC 72133-2 panel, 72172-0 total).
     - No education-point adjustment is applied.
     - If multiple MoCAs occur the same calendar day, the lowest score is chosen.
   ============================================================ */

WITH dementia_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'F01%'
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'F02%'
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'F03%'
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'G30%'
),

/* -------------------------
   RAW: MoCA observations
   ------------------------- */
moca_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                AS resource_id,
    'Observation'                                   AS resource_type,
    COALESCE(NULLIF(o.STATUS,''), 'final')          AS status,
    COALESCE(o.START_DATE, o.END_DATE)              AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS,
    o.NOTE_TEXT,
    o.DATA_SOURCE,
    /* pull first numeric token (handles "23", "23/30", etc.) */
    REGEXP_SUBSTR(o.RESULT, '[-+]?[0-9]*\\.?[0-9]+') AS value_token
  FROM CORE_V3.CORE__OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '72133-2',  -- Montreal Cognitive Assessment [MoCA]
    '72172-0'   -- Total score [MoCA]
  )
),

/* -------------------------
   NORM: numeric score 0–30
   ------------------------- */
moca_norm AS (
  SELECT
    r.*,
    /* Coerce to integer score, clamp to plausible 0–30 range */
    LEAST(30, GREATEST(0, TRY_TO_DOUBLE(r.value_token))) AS moca_score
  FROM moca_raw r
),

/* -------------------------
   CLEAN: remove null/implausible & dx exclusions
   ------------------------- */
moca_clean AS (
  SELECT *
  FROM moca_norm n
  WHERE moca_score IS NOT NULL
    AND moca_score BETWEEN 0 AND 30
    AND NOT EXISTS (
      SELECT 1
      FROM dementia_dx_exclusion x
      WHERE x.PATIENT_ID = n.PATIENT_ID
    )
),

/* -------------------------
   DAILY_PICK: choose lowest (worst) MoCA per patient-day
   ------------------------- */
moca_daily AS (
  SELECT
    c.*,
    CAST(c.obs_date AS DATE) AS obs_day,
    ROW_NUMBER() OVER (
      PARTITION BY c.PATIENT_ID, CAST(c.obs_date AS DATE)
      ORDER BY c.moca_score ASC, c.obs_date DESC, c.resource_id
    ) AS rn
  FROM moca_clean c
),
moca_daily_worst AS (
  SELECT *
  FROM moca_daily
  WHERE rn = 1
),

/* -------------------------
   SUSPECT: two tiers
   ------------------------- */
dementia_moca_lt18 AS (
  SELECT
    d.PATIENT_ID,
    'dementia_moca_lt18'                  AS suspect_group,
    'F03.9'                               AS suspect_icd10_code,
    'Dementia, unspecified (MoCA < 18)'   AS suspect_icd10_short_description,

    d.resource_id,
    d.resource_type,
    d.status,
    d.obs_date,
    /* map for FHIR */
    d.LOINC_CODE,
    d.LOINC_DISPLAY,
    d.moca_score,
    d.RESULT,
    d.UNITS,
    d.NOTE_TEXT,
    d.DATA_SOURCE
  FROM moca_daily_worst d
  WHERE d.moca_score < 18
),
dementia_moca_18_21 AS (
  SELECT
    d.PATIENT_ID,
    'dementia_moca_18_21'                       AS suspect_group,
    'F03.9'                                      AS suspect_icd10_code,
    'Dementia, unspecified (MoCA 18–21)'         AS suspect_icd10_short_description,

    d.resource_id,
    d.resource_type,
    d.status,
    d.obs_date,
    /* map for FHIR */
    d.LOINC_CODE,
    d.LOINC_DISPLAY,
    d.moca_score,
    d.RESULT,
    d.UNITS,
    d.NOTE_TEXT,
    d.DATA_SOURCE
  FROM moca_daily_worst d
  WHERE d.moca_score BETWEEN 18 AND 21
),

dementia_suspects AS (
  SELECT * FROM dementia_moca_lt18
  UNION ALL
  SELECT * FROM dementia_moca_18_21
),

/* -------------------------
   FHIR: minimal Observation per supporting hit
   ------------------------- */
dementia_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        s.status,
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.LOINC_CODE,
            'display',  NULLIF(s.LOINC_DISPLAY,'')
          )
        )
      ),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.moca_score,
        'unit',  NULL  -- MoCA is a unitless total score
      ),
      'note', IFF(s.NOTE_TEXT IS NOT NULL AND s.NOTE_TEXT <> '',
        ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('text', s.NOTE_TEXT)),
        NULL
      ),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM dementia_suspects s
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
      'resource_type', 'Observation',
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM dementia_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
