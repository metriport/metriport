WITH diabetes_observations AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    'observation' AS resource_type,
    CASE
      WHEN o.normalized_code = '4548-4' AND TRY_CAST(o.result AS FLOAT) >= 6.5 THEN 'diabetes_hba1c'
      WHEN o.normalized_code = '14743-9' AND TRY_CAST(o.result AS FLOAT) >= 126 THEN 'diabetes_fpg'
      WHEN o.normalized_code = '14941-1' AND TRY_CAST(o.result AS FLOAT) >= 200 THEN 'diabetes_ogtt'
      WHEN o.normalized_code = '15074-8' AND TRY_CAST(o.result AS FLOAT) >= 200 THEN 'diabetes_random'
      ELSE NULL
    END AS suspect_group
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code IN ('4548-4','14743-9','14941-1','15074-8')
),

diabetes_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    'condition' AS resource_type,
    CASE
      WHEN c.normalized_code LIKE 'E10%' THEN 'diabetes_type1'
      WHEN c.normalized_code LIKE 'E11%' THEN 'diabetes_type2'
      ELSE NULL
    END AS suspect_group
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND (
      c.normalized_code LIKE 'E10.%'
      OR c.normalized_code LIKE 'E11.%'
    )
),

all_diabetes_flags AS (
  SELECT * FROM diabetes_observations
  UNION ALL
  SELECT * FROM diabetes_conditions
)

SELECT
  patient_id,
  suspect_group,
  '' as suspect_icd10_code,
  '' as suspect_icd10_short_description,
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id', resource_id,
      'resource_type', resource_type
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() as last_run
FROM all_diabetes_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group
ORDER BY patient_id, suspect_group;