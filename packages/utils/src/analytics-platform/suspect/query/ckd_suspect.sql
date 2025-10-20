WITH low_egfr AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    CAST(o.result AS FLOAT) AS egfr,
    CAST(o.observation_date AS DATE) AS obs_date
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code = '62319-8'  -- eGFR
    AND TRY_CAST(o.result AS FLOAT) < 60
),
chronic_ckd_patients AS (
  SELECT DISTINCT
    l1.patient_id
  FROM low_egfr l1
  JOIN low_egfr l2
    ON l1.patient_id = l2.patient_id
   AND l2.obs_date >= DATEADD(day, 90, l1.obs_date)
),
ckd_observations AS (
  SELECT
    l.patient_id,
    l.resource_id,
    CASE
      WHEN l.egfr BETWEEN 30 AND 44 THEN 'ckd_stage3b'
      WHEN l.egfr BETWEEN 15 AND 29 THEN 'ckd_stage4'
      WHEN l.egfr < 15 THEN 'ckd_stage5'
      ELSE 'ckd_stage3a'
    END AS suspect_group,
    CASE
      WHEN l.egfr BETWEEN 30 AND 44 THEN 'N18.32'
      WHEN l.egfr BETWEEN 15 AND 29 THEN 'N18.4'
      WHEN l.egfr < 15 THEN 'N18.5'
      ELSE 'N18.31'
    END AS suspect_icd10_code,
    CASE
      WHEN l.egfr BETWEEN 30 AND 44 THEN 'Chronic kidney disease, stage 3b'
      WHEN l.egfr BETWEEN 15 AND 29 THEN 'Chronic kidney disease, stage 4'
      WHEN l.egfr < 15 THEN 'Chronic kidney disease, stage 5'
      ELSE 'Chronic kidney disease, stage 3a'
    END AS suspect_icd10_short_description
  FROM low_egfr l
  WHERE l.patient_id IN (SELECT patient_id FROM chronic_ckd_patients)
),
ckd_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    CASE
      WHEN c.normalized_code = 'N18.31' THEN 'ckd_stage3a'
      WHEN c.normalized_code = 'N18.32' THEN 'ckd_stage3b'
      WHEN c.normalized_code = 'N18.3'  THEN 'ckd_stage3'
      WHEN c.normalized_code = 'N18.4'  THEN 'ckd_stage4'
      WHEN c.normalized_code = 'N18.5'  THEN 'ckd_stage5'
      WHEN c.normalized_code = 'N18.6'  THEN 'esrd'
      ELSE NULL
    END AS suspect_group,
    c.normalized_code AS suspect_icd10_code,
    CASE
      WHEN c.normalized_code = 'N18.31' THEN 'Chronic kidney disease, stage 3a'
      WHEN c.normalized_code = 'N18.32' THEN 'Chronic kidney disease, stage 3b'
      WHEN c.normalized_code = 'N18.3'  THEN 'Chronic kidney disease, stage 3'
      WHEN c.normalized_code = 'N18.4'  THEN 'Chronic kidney disease, stage 4'
      WHEN c.normalized_code = 'N18.5'  THEN 'Chronic kidney disease, stage 5'
      WHEN c.normalized_code = 'N18.6'  THEN 'End stage renal disease'
      ELSE NULL
    END AS suspect_icd10_short_description
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND c.normalized_code IN ('N18.31', 'N18.32','N18.3','N18.4','N18.5','N18.6')
),
all_ckd_flags AS (
  SELECT * FROM ckd_observations
  UNION ALL
  SELECT * FROM ckd_conditions
)
SELECT
  patient_id,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id', resource_id,
      'resource_type', CASE WHEN resource_id IN (SELECT observation_id FROM OBSERVATION) THEN 'observation' ELSE 'condition' END
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() as last_run
FROM all_ckd_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY patient_id, suspect_group;