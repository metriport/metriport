WITH bmi_observations AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    'observation' AS resource_type,
    CASE
      WHEN o.normalized_code = '39156-5' AND CAST(o.result AS FLOAT) >= 40 THEN 'morbid_obesity'
      ELSE NULL
    END AS suspect_group,
    CASE
      WHEN o.normalized_code = '39156-5' AND CAST(o.result AS FLOAT) >= 40 THEN 'E66.01'
      ELSE NULL
    END AS suspect_icd10_code,
    CASE
      WHEN o.normalized_code = '39156-5' AND CAST(o.result AS FLOAT) >= 40 THEN 'Morbid (severe) obesity due to excess calories'
      ELSE NULL
    END AS suspect_icd10_short_description
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code = '39156-5'
    AND TRY_CAST(o.result AS FLOAT) >= 35
),
obesity_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    'condition' AS resource_type,
    CASE
      WHEN c.normalized_code = 'E66.01' THEN 'morbid_obesity'
      WHEN c.normalized_code = 'E66.2'  THEN 'morbid_obesity'
      WHEN c.normalized_code = 'E66.813' THEN 'morbid_obesity'
      ELSE NULL
    END AS suspect_group,
    c.normalized_code AS suspect_icd10_code,
    CASE
      WHEN c.normalized_code = 'E66.01'  THEN 'Morbid (severe) obesity due to excess calories'
      WHEN c.normalized_code = 'E66.2'   THEN 'Morbid obesity'
      WHEN c.normalized_code = 'E66.813' THEN 'Other obesity due to excess calories'
      ELSE NULL
    END AS suspect_icd10_short_description
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND c.normalized_code IN ('E66.01','E66.2','E66.813')
),
all_obesity_flags AS (
  SELECT * FROM bmi_observations
  UNION ALL
  SELECT * FROM obesity_conditions
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
FROM all_obesity_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY patient_id, suspect_group;
