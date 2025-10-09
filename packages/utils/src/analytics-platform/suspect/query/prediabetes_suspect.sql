WITH prediabetes_observations AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    'observation' AS resource_type,
    CASE
      WHEN o.normalized_code = '4548-4' AND CAST(o.result AS FLOAT) BETWEEN 5.7 AND 6.4 THEN 'prediabetes'
      WHEN o.normalized_code = '14743-9' AND CAST(o.result AS FLOAT) BETWEEN 100 AND 125 THEN 'prediabetes'
      WHEN o.normalized_code = '14941-1' AND CAST(o.result AS FLOAT) BETWEEN 140 AND 199 THEN 'prediabetes'
      ELSE NULL
    END AS suspect_group,
    CASE
      WHEN o.normalized_code IN ('4548-4','14743-9','14941-1') THEN 'R73.03'
      ELSE NULL
    END AS suspect_icd10_code,
    CASE
      WHEN o.normalized_code IN ('4548-4','14743-9','14941-1') THEN 'Prediabetes'
      ELSE NULL
    END AS suspect_icd10_short_description
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code IN ('4548-4','14743-9','14941-1')
    AND TRY_CAST(o.result AS FLOAT) BETWEEN 5.7 AND 199
),
prediabetes_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    'condition' AS resource_type,
    'prediabetes' AS suspect_group,
    c.normalized_code AS suspect_icd10_code,
    'Prediabetes' AS suspect_icd10_short_description
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND c.normalized_code = 'R73.03'
),
all_prediabetes_flags AS (
  SELECT * FROM prediabetes_observations
  UNION ALL
  SELECT * FROM prediabetes_conditions
)
SELECT
  patient_id,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  ARRAY_AGG(
    OBJECT_CONSTRUCT(
      'id', resource_id,
      'resource_type', resource_type
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() as last_run
FROM all_prediabetes_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY patient_id, suspect_group;
