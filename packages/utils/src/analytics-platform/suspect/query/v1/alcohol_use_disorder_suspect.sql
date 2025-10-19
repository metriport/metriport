/* ============================================================
   ALCOHOL USE DISORDER — SUSPECT QUERY
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Data sources (new schema):
     • CORE__OBSERVATION  — ethanol lab (LOINC 5643-2)
     • CORE__CONDITION    — ICD-10 exclusions (F10% alcohol disorders)
     • CORE__PROCEDURE    — OPTIONAL “strong add set” (SBIRT/BI CPT/HCPCS)
                            gated by alcohol-harm SNOMED reasons

   Purpose:
     1) Lab path (primary): Identify suspects based on blood alcohol level
        (BAL) from CORE__OBSERVATION where LOINC_CODE = '5643-2'.
        We normalize units to mg/dL:
          - mg/dL → as-is
          - g/dL  → × 1000
          - % (w/v) → × 1000  (≈ g/dL)
        Plausibility guard: keep 10–1000 mg/dL. Require non-empty units
        and a numeric token > 0. Exclude patients with F10% in CORE__CONDITION.
        Threshold buckets (exactly matching original logic):
          - ≥ 300 mg/dL → alcohol_very_high_300plus
          - 200–299 mg/dL → alcohol_high_200plus
          - 80–199 mg/dL  → alcohol_positive_80plus

     2) Procedure path (optional strong add set): Add suspects when a
        documented brief intervention/screening (SBIRT) procedure exists,
        but only when paired with high-specificity alcohol-harm reasons
        (SNOMED). Codes included (with comments below) and reasons:
          - SNOMED reasons:
              '15167005'   -- Harmful pattern of use of alcohol (disorder)
              '420054005'  -- Alcoholic cirrhosis (disorder)
          - CPT/HCPCS (commented inline in the WHERE):
              '99408'  -- Structured screening & brief intervention; 15–30 min
              '99409'  -- Structured screening & brief intervention; >30 min
              'G0396'  -- Alcohol/substance misuse assessment + BI; 15–30 min (Medicare)
              'G0397'  -- Alcohol/substance misuse assessment + BI; >30 min (Medicare)
              'G0443'  -- Brief face-to-face behavioral counseling for alcohol misuse; 15 min (Medicare)
        Exclude patients with F10% diagnoses. Emits suspect_group 'alcohol_sbirt_intervention'.

   Output:
     One row per (PATIENT_ID, suspect_group) with aggregated
     responsible_resources (Observation and/or Procedure) each carrying
     a minimal FHIR payload for UI review.

   This query is a direct functional mapping of the original logic to
   the new CORE__OBSERVATION / CORE__CONDITION / CORE__PROCEDURE schema.
   ============================================================ */

WITH aud_dx_exclusion AS (
  /* Patients already diagnosed with alcohol-related disorders (exclude) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'F10%'
),

/* -------------------------
   RAW: pull rows, extract numeric, require units
   ------------------------- */
ethanol_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                               AS resource_id,
    'Observation'                                                  AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.RESULT,
    o.UNITS                                                        AS units_raw,
    /* Extract the first numeric piece (handles "0.08 %", "300 mg/dL", etc.) */
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE = '5643-2'  -- Ethanol [Mass/volume] in Serum or Plasma
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    /* Require non-empty units up front */
    AND NULLIF(o.UNITS, '') IS NOT NULL
    /* ensure numeric token > 0 */
    AND TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) > 0
),

/* -------------------------
   NORM: normalize value → mg/dL and set canonical units
   ------------------------- */
ethanol_norm AS (
  SELECT
    r.*,
    /* Convert to mg/dL for thresholding */
    CASE
      WHEN r.units_raw ILIKE '%mg/dl%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%g/dl%'  THEN TRY_TO_DOUBLE(r.value_token) * 1000.0
      WHEN r.units_raw ILIKE '%\%%'    THEN TRY_TO_DOUBLE(r.value_token) * 1000.0   -- % w/v ≈ g/dL
      ELSE NULL
    END AS value_mg_dl,
    /* canonical units for downstream use */
    'mg/dL' AS units
  FROM ethanol_raw r
),

/* -------------------------
   CLEAN: plausibility & diagnosis exclusions
   ------------------------- */
ethanol_clean AS (
  SELECT *
  FROM ethanol_norm n
  WHERE n.value_mg_dl IS NOT NULL
    /* conservative plausibility range for BAL values in mg/dL */
    AND n.value_mg_dl BETWEEN 10 AND 1000
    AND NOT EXISTS (SELECT 1 FROM aud_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: assign screening buckets (unchanged)
   ------------------------- */
ethanol_suspects AS (
  SELECT
    e.PATIENT_ID,

    CASE
      WHEN e.value_mg_dl >= 300 THEN 'alcohol_very_high_300plus'
      WHEN e.value_mg_dl >= 200 THEN 'alcohol_high_200plus'
      WHEN e.value_mg_dl >=  80 THEN 'alcohol_positive_80plus'
      ELSE NULL
    END AS suspect_group,

    /* ICD-10 label for reviewer context (not a diagnosis by itself) */
    'F10.9'  AS suspect_icd10_code,
    'Alcohol use, unspecified (BAC)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    e.resource_id,
    e.resource_type,
    e.LOINC_CODE,
    e.LOINC_DISPLAY,
    e.RESULT,
    e.units,                    -- canonical units from NORM
    e.value_mg_dl AS value_num, -- canonical numeric
    e.obs_date,
    e.DATA_SOURCE
  FROM ethanol_clean e
  WHERE e.value_mg_dl >= 80  -- lowest screening threshold
),

/* ============================================================
   OPTIONAL "STRONG ADD SET": SBIRT/BRIEF INTERVENTION PROCEDURES
   (Only when paired with alcohol-harm SNOMED reasons for specificity.)
   ============================================================ */
sbirt_suspects AS (
  SELECT
    p.PATIENT_ID,
    'alcohol_sbirt_intervention' AS suspect_group,
    'F10.9' AS suspect_icd10_code,
    'Alcohol use, unspecified (screen positive)' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    p.PROCEDURE_ID AS resource_id,
    'Procedure'     AS resource_type,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    CAST(p.START_DATE AS DATE) AS proc_date,
    p.DATA_SOURCE
  FROM CORE__PROCEDURE p
  WHERE UPPER(p.CPT_CODE) IN (
      '99408',  -- Alcohol and/or substance (other than tobacco) abuse structured screening & brief intervention; 15–30 minutes
      '99409',  -- Alcohol and/or substance (other than tobacco) abuse structured screening & brief intervention; >30 minutes
      'G0396',  -- Alcohol/substance misuse structured assessment (e.g., AUDIT/DAST) and brief intervention; 15–30 minutes (Medicare)
      'G0397',  -- Alcohol/substance misuse structured assessment (e.g., AUDIT/DAST) and brief intervention; >30 minutes (Medicare)
      'G0443'   -- Brief face-to-face behavioral counseling for alcohol misuse; 15 minutes (Medicare)
    )
     /* Require explicit alcohol-harm reason to avoid false positives */
    AND p.REASON_SNOMED_CODE IN (
      '15167005',   -- Harmful pattern of use of alcohol (disorder)
      '420054005'   -- Alcoholic cirrhosis (disorder)
    )
    AND NOT EXISTS (SELECT 1 FROM aud_dx_exclusion x WHERE x.PATIENT_ID = p.PATIENT_ID)
),

/* -------------------------
   Build FHIR payloads per resource type
   ------------------------- */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     s.LOINC_CODE,
            'display',  s.LOINC_DISPLAY
          )
        )
      ),
      'effectiveDateTime', TO_VARCHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT('value', s.value_num, 'unit', s.units),
      /* Preserve original RESULT if needed (e.g., textual) */
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,

    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM ethanol_suspects s
  WHERE s.suspect_group IS NOT NULL
),

proc_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.CPT_DISPLAY, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     s.CPT_CODE,
            'display',  s.CPT_DISPLAY
          )
        )
      ),
      'performedDateTime', TO_VARCHAR(s.proc_date, 'YYYY-MM-DD')
    ) AS fhir,

    s.resource_id,
    'Procedure' AS resource_type,
    s.DATA_SOURCE AS data_source
  FROM sbirt_suspects s
),

all_with_fhir AS (
  SELECT * FROM obs_with_fhir
  UNION ALL
  SELECT * FROM proc_with_fhir
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
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM all_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
