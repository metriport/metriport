/* ============================================================
   DEMENTIA (MoCA-based + NMDA Rx) — SUSPECT QUERY
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → DAILY_PICK → SUSPECT → FHIR → RETURN
   Adds Rx path:
     • Treatment with NMDA receptor antagonist (memantine),
       including brand combos (Namenda, Namzaric).
   Notes
     • Rx path uses only MedicationRequest joined to Medication.
     • Rx path also excludes known dementia diagnoses (same as MoCA path).
   ============================================================ */

WITH dementia_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'F01%'  -- Vascular dementia
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'F02%'  -- Dementia in other diseases
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'F03%'  -- Unspecified dementia
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'G30%'  -- Alzheimer disease
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
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)          AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                         AS RESULT,
    o.UNITS,
    o.NOTE_TEXT,
    o.DATA_SOURCE,
    REGEXP_SUBSTR(o.VALUE, '[-+]?[0-9]*\\.?[0-9]+') AS value_token
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '72172-2',  -- Montreal Cognitive Assessment [MoCA]
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
    AND NOT EXISTS (SELECT 1 FROM dementia_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
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
  SELECT * FROM moca_daily WHERE rn = 1
),

/* -------------------------
   SUSPECT (Observation/MoCA): two tiers
   ------------------------- */
dementia_moca_lt18 AS (
  SELECT
    d.PATIENT_ID,
    'dementia_moca_lt18'                  AS suspect_group,
    'F03.9'                               AS suspect_icd10_code,
    'Dementia, unspecified (MoCA < 18)'   AS suspect_icd10_short_description,

    d.resource_id, d.resource_type, d.status, d.obs_date,
    d.LOINC_CODE, d.LOINC_DISPLAY,
    /* Rx fields null for obs path */
    NULL AS RXNORM_CODE, NULL AS RXNORM_DISPLAY,
    d.moca_score, d.RESULT, d.UNITS, d.NOTE_TEXT, d.DATA_SOURCE
  FROM moca_daily_worst d
  WHERE d.moca_score < 18
),
dementia_moca_18_21 AS (
  SELECT
    d.PATIENT_ID,
    'dementia_moca_18_21'                 AS suspect_group,
    'F03.9'                               AS suspect_icd10_code,
    'Dementia, unspecified (MoCA 18–21)'  AS suspect_icd10_short_description,

    d.resource_id, d.resource_type, d.status, d.obs_date,
    d.LOINC_CODE, d.LOINC_DISPLAY,
    NULL AS RXNORM_CODE, NULL AS RXNORM_DISPLAY,
    d.moca_score, d.RESULT, d.UNITS, d.NOTE_TEXT, d.DATA_SOURCE
  FROM moca_daily_worst d
  WHERE d.moca_score BETWEEN 18 AND 21
),

/* ============================================================
   MEDICATION PATH (MedicationRequest + Medication join)
   ------------------------------------------------------------
   Include only NMDA receptor antagonist used for dementia:
     - Memantine (generic) and brands Namenda, Namzaric
   Exclude if patient already carries a dementia dx (same exclusion).
   ============================================================ */
/* RAW: pull memantine/Namenda/Namzaric MedicationRequests */
nmda_rx_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                         AS resource_id,
    'MedicationRequest'                              AS resource_type,
    COALESCE(NULLIF(mr.STATUS,''), 'active')         AS status,
    mr.AUTHORED_ON                                   AS obs_date,
    /* Prefer RxNorm identifiers; fall back to NDC if RxNorm is missing */
    COALESCE(NULLIF(m.RXNORM_CODE,''), NULLIF(m.NDC_CODE,''))         AS RXNORM_CODE,
    COALESCE(NULLIF(m.RXNORM_DISPLAY,''), NULLIF(m.NDC_DISPLAY,''))   AS RXNORM_DISPLAY,
    /* For union compatibility with obs path */
    NULL AS LOINC_CODE, NULL AS LOINC_DISPLAY,
    /* MoCA/Obs-only fields set NULL */
    NULL AS moca_score, NULL AS RESULT, NULL AS UNITS, NULL AS NOTE_TEXT,
    mr.DATA_SOURCE
  FROM CORE_V3.MEDICATION_REQUEST mr
  JOIN CORE_V3.MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE
    /* match only dementia-specific NMDA antagonist products */
    UPPER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE 'MEMANTINE%'  -- generic and salt forms
    OR UPPER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE 'NAMENDA%' -- memantine brand
    OR UPPER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) LIKE 'NAMZARIC%'-- memantine + donepezil
),

/* CLEAN: exclude known dementia dx */
nmda_rx_clean AS (
  SELECT *
  FROM nmda_rx_raw r
  WHERE NOT EXISTS (SELECT 1 FROM dementia_dx_exclusion x WHERE x.PATIENT_ID = r.PATIENT_ID)
  AND NULLIF(r.DATA_SOURCE, '') IS NOT NULL
),

/* SUSPECT: NMDA treatment signal */
dementia_nmda_rx AS (
  SELECT
    r.PATIENT_ID,
    'dementia_nmda_memantine_rx'             AS suspect_group,
    'F03.9'                                  AS suspect_icd10_code,
    'Dementia, unspecified (memantine treatment)' AS suspect_icd10_short_description,

    r.resource_id, r.resource_type, r.status, r.obs_date,
    /* keep RxNorm fields for FHIR */
    r.LOINC_CODE, r.LOINC_DISPLAY,
    r.RXNORM_CODE, r.RXNORM_DISPLAY,
    r.moca_score, r.RESULT, r.UNITS, r.NOTE_TEXT, r.DATA_SOURCE
  FROM nmda_rx_clean r
),

/* -------------------------
   UNION ALL SUSPECTS
   ------------------------- */
dementia_suspects AS (
  SELECT * FROM dementia_moca_lt18
  UNION ALL
  SELECT * FROM dementia_moca_18_21
  UNION ALL
  SELECT * FROM dementia_nmda_rx
),

/* -------------------------
   FHIR: Observation or MedicationRequest (minimal)
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

    /* Build per-type minimal FHIR */
    CASE
      WHEN s.resource_type = 'Observation' THEN
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
            'unit',  NULL  -- unitless total score
          ),
          'note', IFF(s.NOTE_TEXT IS NOT NULL AND s.NOTE_TEXT <> '',
            ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('text', s.NOTE_TEXT)),
            NULL
          ),
          'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
        )
      ELSE
        OBJECT_CONSTRUCT(
          'resourceType', 'MedicationRequest',
          'id',            s.resource_id,
          'status',        s.status,
          'intent',        'order',
          'medicationCodeableConcept', OBJECT_CONSTRUCT(
            'text',   NULLIF(s.RXNORM_DISPLAY,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system',  'http://www.nlm.nih.gov/research/umls/rxnorm',
                'code',     s.RXNORM_CODE,
                'display',  NULLIF(s.RXNORM_DISPLAY,'')
              )
            )
          ),
          'authoredOn', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
        )
    END AS fhir
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
      'resource_type', resource_type,   -- Observation or MedicationRequest
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM dementia_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
