WITH bp_observations AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    'observation' AS resource_type,
    CASE
      WHEN o.normalized_code = '8480-6' AND CAST(o.result AS FLOAT) >= 140 THEN 'stage2_systolic'
      WHEN o.normalized_code = '8462-4' AND CAST(o.result AS FLOAT) >= 90  THEN 'stage2_diastolic'
      WHEN o.normalized_code = '8480-6' AND CAST(o.result AS FLOAT) >= 130 THEN 'stage1_systolic'
      WHEN o.normalized_code = '8462-4' AND CAST(o.result AS FLOAT) >= 80  THEN 'stage1_diastolic'
      ELSE NULL
    END AS suspect_group
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code IN ('8480-6','8462-4')
),

htn_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    'condition' AS resource_type,
    CASE
      WHEN c.normalized_code = 'I10' THEN 'essential_hypertension'
      WHEN c.normalized_code LIKE 'I11%' THEN 'hypertensive_heart_disease'
      WHEN c.normalized_code LIKE 'I12%' THEN 'hypertensive_ckd'
      WHEN c.normalized_code LIKE 'I13%' THEN 'hypertensive_heart_ckd'
      ELSE NULL
    END AS suspect_group
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND c.normalized_code IN ('I10','I11.0','I11.9','I12.0','I12.9','I13.0','I13.10','I13.11','I13.2')
),

all_htn_flags AS (
  SELECT * FROM bp_observations
  UNION ALL
  SELECT * FROM htn_conditions
)

SELECT
    patient_id,
    suspect_group,
    ARRAY_AGG(
    OBJECT_CONSTRUCT(
        'id', resource_id,
        'resource_type', resource_type
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() as last_run
FROM all_htn_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group
ORDER BY patient_id, suspect_group