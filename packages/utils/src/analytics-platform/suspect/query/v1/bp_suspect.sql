/* ============================================================
   HYPERTENSION — SUSPECT QUERY (BP Observations + HTN Meds)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "hypertension suspects" from discrete BP observations:
       - 8480-6: Systolic blood pressure
       - 8462-4: Diastolic blood pressure
     while excluding anyone already diagnosed with HTN (I10–I15).

   Staging thresholds (single-observation labeling):
     - Stage 2 HTN: SBP ≥ 140  OR  DBP ≥ 90
     - Stage 1 HTN: SBP 130–139 OR DBP 80–89

   New schemas used:
     • OBSERVATION  (LOINC_CODE, LOINC_DISPLAY, RESULT, UNITS, START_DATE)
     • CONDITION    (ICD_10_CM_CODE)
   ============================================================ */

WITH htn_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE LEFT(c.ICD_10_CM_CODE, 3) IN ('I10','I11','I12','I13','I15')
),

/* -------------------------
   RAW: pull rows, extract numeric, require units
   ------------------------- */
bp_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                            AS RESULT,
    o.UNITS                                                            AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE o.LOINC_CODE IN ('8480-6','8462-4')
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS, '') IS NOT NULL
    AND TRY_TO_DOUBLE(REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')) > 0
),

/* -------------------------
   NORM: keep only mmHg variants; canonicalize to mmHg
   ------------------------- */
bp_norm AS (
  SELECT
    r.*,
    CASE
      /* Normalize mm/Hg, mm Hg, mm[Hg], mmHg (strip non-letters, compare to 'mmhg') */
      WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z]', '') = 'mmhg' THEN 'mmHg'
      ELSE NULL
    END AS units_disp,
    CASE
      WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z]', '') = 'mmhg'
        THEN TRY_TO_DOUBLE(r.value_token)
      ELSE NULL
    END AS value_mmhg
  FROM bp_raw r
),

/* -------------------------
   CLEAN: keep plausible, canonicalized rows; drop known HTN dx
   ------------------------- */
bp_clean AS (
  SELECT *
  FROM bp_norm n
  WHERE n.value_mmhg IS NOT NULL
    AND n.value_mmhg >= 80
    AND n.value_mmhg <= 250
    AND n.units_disp IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM htn_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT: assign stage buckets (stage2 precedence)
   ------------------------- */
bp_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.LOINC_CODE = '8480-6' AND c.value_mmhg >= 140 THEN 'stage2_systolic'
      WHEN c.LOINC_CODE = '8462-4' AND c.value_mmhg >=  90 THEN 'stage2_diastolic'
      WHEN c.LOINC_CODE = '8480-6' AND c.value_mmhg BETWEEN 130 AND 139 THEN 'stage1_systolic'
      WHEN c.LOINC_CODE = '8462-4' AND c.value_mmhg BETWEEN  80 AND  89 THEN 'stage1_diastolic'
      ELSE NULL
    END AS suspect_group,

    'I10'  AS suspect_icd10_code,
    'Essential (primary) hypertension' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units_disp AS units,         -- canonical output
    c.value_mmhg AS value_num,     -- canonical numeric
    c.obs_date,
    c.DATA_SOURCE
  FROM bp_clean c
  WHERE
    ( (c.LOINC_CODE = '8480-6' AND c.value_mmhg >= 130)   -- systolic thresholds
      OR
      (c.LOINC_CODE = '8462-4' AND c.value_mmhg >= 80) )  -- diastolic thresholds
),

/* -------------------------
   FHIR for Observations (Zod-safe)
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
        'text',   COALESCE(s.LOINC_DISPLAY, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     COALESCE(s.LOINC_CODE, ''),
            'display',  COALESCE(s.LOINC_DISPLAY, '')
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_num,
        'unit',  'mmHg'
      )
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM bp_suspects s
),

/* ============================================================
   MEDICATION PATH — HTN-only combos (RxNorm whitelist)
   ============================================================ */
med_rx_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                         AS resource_id,
    'MedicationRequest'                              AS resource_type,
    COALESCE(NULLIF(mr.STATUS,''), 'active')         AS status,
    mr.AUTHORED_ON                                   AS authored_on,
    m.RXNORM_CODE,
    m.RXNORM_DISPLAY,
    mr.DATA_SOURCE
  FROM CORE_V3.MEDICATION_REQUEST mr
  JOIN CORE_V3.MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE COALESCE(NULLIF(mr.STATUS,''), 'active') NOT IN ('entered-in-error','stopped','cancelled')
    AND mr.AUTHORED_ON >= DATEADD(month, -18, CURRENT_DATE)
    AND m.RXNORM_CODE IN (
      -- ===== HTN-only fixed-dose combos (RxNorm) =====
      '85783',    -- lisinopril-hydrochlorothiazide
      '197885',   -- hydrochlorothiazide 12.5 MG / lisinopril 10 MG Oral Tablet
      '197886',   -- hydrochlorothiazide 12.5 MG / lisinopril 20 MG Oral Tablet
      '197887',   -- hydrochlorothiazide 25 MG / lisinopril 20 MG Oral Tablet
      '200284',   -- hydrochlorothiazide 12.5 MG / valsartan 80 MG Oral Tablet
      '200285',   -- valsartan 160 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '207961',   -- hydrochlorothiazide 12.5 MG / lisinopril 10 MG Oral Tablet [Prinzide]
      '214223',   -- amlodipine / benazepril
      '214617',   -- hydrochlorothiazide / irbesartan
      '214618',   -- hydrochlorothiazide / lisinopril
      '214619',   -- hydrochlorothiazide / losartan
      '214626',   -- hydrochlorothiazide / valsartan
      '217681',   -- losartan-hydrochlorothiazide
      '218090',   -- amlodipine-benazepril
      '283316',   -- telmisartan 40 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '283317',   -- telmisartan 80 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '310792',   -- irbesartan 150 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '310793',   -- irbesartan 300 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '310796',   -- quinapril 10 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '310809',   -- quinapril 20 MG / hydrochlorothiazide 25 MG Oral Tablet
      '349353',   -- hydrochlorothiazide 25 MG / valsartan 160 MG Oral Tablet
      '403853',   -- hydrochlorothiazide 12.5 MG / olmesartan medoxomil 20 MG Oral Tablet
      '403854',   -- hydrochlorothiazide 12.5 MG / olmesartan medoxomil 40 MG Oral Tablet
      '403855',   -- hydrochlorothiazide 25 MG / olmesartan medoxomil 40 MG Oral Tablet
      '404880',   -- olmesartan-hydrochlorothiazide
      '477130',   -- telmisartan 80 MG / hydrochlorothiazide 25 MG Oral Tablet
      '485471',   -- irbesartan 300 MG / hydrochlorothiazide 25 MG Oral Tablet
      '578325',   -- candesartan cilexetil 16 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '578330',   -- candesartan cilexetil 32 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '636042',   -- valsartan 320 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '636045',   -- hydrochlorothiazide 25 MG / valsartan 320 MG Oral Tablet
      '722126',   -- amlodipine 10 MG / valsartan 160 MG Oral Tablet
      '722131',   -- amlodipine 10 MG / valsartan 320 MG Oral Tablet
      '722134',   -- amlodipine 5 MG / valsartan 160 MG Oral Tablet
      '722137',   -- amlodipine 5 MG / valsartan 320 MG Oral Tablet
      '730861',   -- amlodipine 10 MG / olmesartan medoxomil 20 MG Oral Tablet
      '730862',   -- amlodipine-olmesartan
      '730866',   -- amlodipine 10 MG / olmesartan medoxomil 40 MG Oral Tablet
      '730869',   -- amlodipine 5 MG / olmesartan medoxomil 20 MG Oral Tablet
      '730872',   -- amlodipine 5 MG / olmesartan medoxomil 40 MG Oral Tablet
      '809014',   -- hydrochlorothiazide 12.5 MG / valsartan 80 MG Oral Tablet [Diovan HCT]
      '848131',   -- amlodipine 10 MG / valsartan 160 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '848135',   -- amlodipine 10 MG / valsartan 320 MG / hydrochlorothiazide 25 MG Oral Tablet
      '848140',   -- amlodipine 5 MG / valsartan 160 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '848145',   -- amlodipine 5 MG / valsartan 160 MG / hydrochlorothiazide 25 MG Oral Tablet
      '848151',   -- amlodipine 10 MG / valsartan 160 MG / hydrochlorothiazide 25 MG Oral Tablet
      '857166',   -- fosinopril sodium 10 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '857174',   -- fosinopril sodium 20 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '858824',   -- enalapril maleate 5 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '858828',   -- enalapril maleate 10 MG / hydrochlorothiazide 25 MG Oral Tablet
      '876514',   -- telmisartan 40 MG / amlodipine 10 MG Oral Tablet
      '876519',   -- telmisartan 80 MG / amlodipine 10 MG Oral Tablet
      '876524',   -- telmisartan 40 MG / amlodipine 5 MG Oral Tablet
      '876529',   -- telmisartan 80 MG / amlodipine 5 MG Oral Tablet
      '898342',   -- amlodipine besylate 10 MG / benazepril HCl 20 MG Oral Capsule
      '898344',   -- amlodipine 10 MG / benazepril hydrochloride 20 MG Oral Capsule [Lotrel]
      '898346',   -- amlodipine besylate 10 MG / benazepril HCl 40 MG Oral Capsule
      '898350',   -- amlodipine besylate 2.5 MG / benazepril HCl 10 MG Oral Capsule
      '898353',   -- amlodipine besylate 5 MG / benazepril HCl 10 MG Oral Capsule
      '898356',   -- amlodipine besylate 5 MG / benazepril HCl 20 MG Oral Capsule
      '898359',   -- amlodipine besylate 5 MG / benazepril HCl 40 MG Oral Capsule
      '898361',   -- amlodipine 5 MG / benazepril hydrochloride 40 MG Oral Capsule [Lotrel]
      '898362',   -- benazepril HCl 10 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '898367',   -- benazepril HCl 20 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '898372',   -- benazepril HCl 20 MG / hydrochlorothiazide 25 MG Oral Tablet
      '898378',   -- benazepril HCl 5 MG / hydrochlorothiazide 6.25 MG Oral Tablet
      '979464',   -- hydrochlorothiazide 12.5 MG / losartan potassium 100 MG Oral Tablet
      '979468',   -- hydrochlorothiazide 12.5 MG / losartan potassium 50 MG Oral Tablet
      '979471',   -- hydrochlorothiazide 25 MG / losartan potassium 100 MG Oral Tablet
      '999967',   -- olmesartan medoxomil 20 MG / amlodipine 5 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '999986',   -- olmesartan medoxomil 40 MG / amlodipine 10 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '999991',   -- olmesartan medoxomil 40 MG / amlodipine 10 MG / hydrochlorothiazide 25 MG Oral Tablet
      '999996',   -- olmesartan medoxomil 40 MG / amlodipine 5 MG / hydrochlorothiazide 12.5 MG Oral Tablet
      '1000001',  -- olmesartan medoxomil 40 MG / amlodipine 5 MG / hydrochlorothiazide 25 MG Oral Tablet
      '1235144',  -- azilsartan medoxomil 40 MG / chlorthalidone 12.5 MG Oral Tablet
      '1235151',  -- azilsartan medoxomil 40 MG / chlorthalidone 25 MG Oral Tablet
      '1600716',  -- perindopril arginine 14 MG / amlodipine 10 MG Oral Tablet
      '1600728'   -- perindopril arginine 7 MG / amlodipine 5 MG Oral Tablet
    )
),
med_rx_clean AS (
  SELECT *
  FROM med_rx_raw r
  WHERE NOT EXISTS (SELECT 1 FROM htn_dx_exclusion x WHERE x.PATIENT_ID = r.PATIENT_ID)
    AND NULLIF(r.DATA_SOURCE,'') IS NOT NULL
),
med_htn_rx AS (
  SELECT
    r.PATIENT_ID,
    'med_htn_combo'                           AS suspect_group,
    'I10'                                     AS suspect_icd10_code,
    'Essential (primary) hypertension'        AS suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType', 'MedicationRequest',
      'id',            r.resource_id,
      'status',        r.status,
      'authoredOn',    TO_CHAR(r.authored_on, 'YYYY-MM-DD'),
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'text',   COALESCE(r.RXNORM_DISPLAY, ''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system','http://www.nlm.nih.gov/research/umls/rxnorm',
            'code',   COALESCE(r.RXNORM_CODE, ''),
            'display',COALESCE(r.RXNORM_DISPLAY, '')
          )
        )
      )
    ) AS fhir,
    r.resource_id,
    r.resource_type,
    r.DATA_SOURCE AS data_source
  FROM med_rx_clean r
),

/* -------------------------
   UNION ALL EVIDENCE (observations + medications)
   ------------------------- */
all_evidence AS (
  SELECT * FROM obs_with_fhir
  UNION ALL
  SELECT * FROM med_htn_rx
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
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM all_evidence
WHERE NULLIF(suspect_group, '') IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
