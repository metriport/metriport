/* ============================================================
   MAJOR DEPRESSION — SUSPECT QUERY (PHQ-9 / PHQ-2 + SSRI Rx)
   Cast-safe: RxNorm code whitelist as VARCHAR to avoid OTH/UNK cast errors
   Now excludes bipolar/psychotic disorders for SSRI suspects
   ============================================================ */

WITH depression_dx_exclusion AS (
  /* Exclude existing depression diagnoses (direct mapping of V2) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'F32%'   -- MDD, single episode (incl. F32.A)
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'F33%'   -- MDD, recurrent
     OR UPPER(c.ICD_10_CM_CODE) = 'F341'      -- Dysthymia
),

/* Additional exclusion: bipolar & psychotic-spectrum conditions */
bipolar_psychotic_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE
    /* Bipolar / manic */
    UPPER(c.ICD_10_CM_CODE) LIKE 'F31%'  -- Bipolar disorder
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F30%'  -- Manic episode

    /* Schizophrenia & other primary psychotic disorders */
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F20%'  -- Schizophrenia
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F22%'  -- Delusional disorders
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F23%'  -- Brief psychotic disorder
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F25%'  -- Schizoaffective
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F28%'  -- Other nonorganic psychoses
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'F29%'  -- Unspecified psychosis
),

/* -------------------------
   PHQ path
   ------------------------- */
phq_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                              AS resource_id,
    'Observation'                                                 AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                       AS RESULT,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)                        AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN ('44261-6','55758-7')
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),
phq_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_score,
    'score'                      AS units
  FROM phq_raw r
),
phq_clean AS (
  SELECT *
  FROM phq_norm n
  WHERE n.value_score IS NOT NULL
    AND (
      (UPPER(n.LOINC_CODE) = '44261-6' AND n.value_score BETWEEN 0 AND 27) OR
      (UPPER(n.LOINC_CODE) = '55758-7' AND n.value_score BETWEEN 0 AND 6)
    )
    AND NOT EXISTS (SELECT 1 FROM depression_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
phq_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN UPPER(c.LOINC_CODE) = '44261-6' AND c.value_score >= 10 THEN 'depression_phq9_10plus'
      WHEN UPPER(c.LOINC_CODE) = '55758-7' AND c.value_score >= 3  THEN 'depression_phq2_3plus'
      ELSE NULL
    END AS suspect_group,
    'F32.A' AS suspect_icd10_code,
    'Depression, unspecified (screen positive)' AS suspect_icd10_short_description,
    c.resource_id,
    c.resource_type,
    c.LOINC_CODE,
    c.LOINC_DISPLAY,
    c.RESULT,
    c.units,
    c.value_score AS value_num,
    c.obs_date,
    c.DATA_SOURCE
  FROM phq_clean c
  WHERE (UPPER(c.LOINC_CODE) = '44261-6' AND c.value_score >= 10)
     OR (UPPER(c.LOINC_CODE) = '55758-7' AND c.value_score >= 3)
),

obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType','Observation',
      'id',            s.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.LOINC_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(OBJECT_CONSTRUCT(
          'system','http://loinc.org','code',s.LOINC_CODE,'display',s.LOINC_DISPLAY
        ))
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date,'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT('value',s.value_num,'unit',s.units),
      'valueString', IFF(TRY_TO_DOUBLE(s.RESULT) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM phq_suspects s
),

/* -------------------------
   SSRI whitelist as VARCHAR (prevents NUMBER casting errors)
   ------------------------- */
ssri_codes(code) AS (
  SELECT TO_VARCHAR(column1) FROM VALUES
  /* citalopram / Celexa */
  ('2556'),('215928'),('284591'),('213344'),('213345'),('283672'),('200371'),('309313'),('2591786'),('309314'),
  /* escitalopram / Lexapro */
  ('321988'),('352741'),('349332'),('351250'),('351249'),('351285'),('352272'),('352273'),('404408'),
  /* fluoxetine / Prozac */
  ('4493'),('58827'),('261282'),('205535'),('104849'),('261287'),('310384'),('313990'),('2532159'),
  ('310385'),('248642'),('2532163'),('310386'),('313989'),('1190110'),
  /* paroxetine / Paxil / Pexeva (incl. mesylate & CR) */
  ('32937'),('114228'),('211699'),('213291'),('207349'),('207350'),('211700'),
  ('1738804'),('1738806'),('541666'),('312244'),('1738483'),('312242'),('1738803'),
  ('1738495'),('1738503'),('1738511'),('1738805'),('1738807'),('1738515'),('1738519'),('1738527'),('1430122'),
  /* sertraline / Zoloft */
  ('36437'),('82728'),('208149'),('861066'),('212233'),('208161'),('312938'),('312941'),
  ('312940'),('410584'),('251201'),('861064'),
  /* fluvoxamine */
  ('903873'),('903884'),('903879'),('903887'),('903891'),
  /* vilazodone / Viibryd */
  ('1086769'),('1086772'),('1086778'),('1086784'),('1653469'),('1086776'),('1086780'),('1086786'),
  /* vortioxetine / Trintellix */
  ('1439808'),('1439810'),('1439812'),('1790886'),('1790890'),('1790892')
  /* Optional SSRI combo: ('403971')  -- olanzapine/fluoxetine (Symbyax) */
),

/* -------------------------
   Medication path (join to whitelist)
   ------------------------- */
ssri_rx_raw AS (
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
  JOIN ssri_codes w
    ON TO_VARCHAR(m.RXNORM_CODE) = w.code
),
ssri_rx_clean AS (
  SELECT *
  FROM ssri_rx_raw r
  WHERE NOT EXISTS (SELECT 1 FROM depression_dx_exclusion x WHERE x.PATIENT_ID = r.PATIENT_ID)
    AND NULLIF(r.DATA_SOURCE,'') IS NOT NULL
    AND NULLIF(r.RXNORM_DISPLAY,'') IS NOT NULL
),

/* SSRI suspects (exclude bipolar/psychotic-spectrum dx) */
ssri_suspects AS (
  SELECT
    r.PATIENT_ID,
    'depression_ssri_treatment'                 AS suspect_group,
    'F32.A'                                     AS suspect_icd10_code,
    'Depression, unspecified (SSRI treatment)'  AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    r.resource_id,
    r.resource_type,
    r.RXNORM_CODE,
    r.RXNORM_DISPLAY,
    r.status,
    r.obs_date,
    r.DATA_SOURCE
  FROM ssri_rx_clean r
  WHERE NOT EXISTS (
    SELECT 1 FROM bipolar_psychotic_exclusion bp
    WHERE bp.PATIENT_ID = r.PATIENT_ID
  )
),

ssri_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType','MedicationRequest',
      'id',            s.resource_id,
      'status',        s.status,
      'intent',        'order',
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.RXNORM_DISPLAY,''),
        'coding', ARRAY_CONSTRUCT(OBJECT_CONSTRUCT(
          'system','http://www.nlm.nih.gov/research/umls/rxnorm',
          'code',  s.RXNORM_CODE,
          'display', NULLIF(s.RXNORM_DISPLAY,'')
        ))
      ),
      'authoredOn', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM ssri_suspects s
),

/* -------------------------
   UNION & RETURN
   ------------------------- */
all_evidence AS (
  SELECT * FROM obs_with_fhir
  UNION ALL
  SELECT * FROM ssri_with_fhir
)

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
FROM all_evidence
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
