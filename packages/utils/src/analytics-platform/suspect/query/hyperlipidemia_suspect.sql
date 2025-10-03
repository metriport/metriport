WITH lipid_observations AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    'observation' AS resource_type,
    CASE
      WHEN o.normalized_code = '13457-7' AND CAST(o.result AS FLOAT) >= 190 THEN 'severe_ldl'
      WHEN o.normalized_code = '13457-7' AND CAST(o.result AS FLOAT) >= 160 THEN 'moderate_ldl'
      WHEN o.normalized_code = '2093-3' AND CAST(o.result AS FLOAT) >= 240 THEN 'mixed_hyperlipidemia'
      ELSE NULL
    END AS suspect_group,
    CASE
      WHEN o.normalized_code = '13457-7' AND CAST(o.result AS FLOAT) >= 190 THEN 'E78.0'
      WHEN o.normalized_code = '13457-7' AND CAST(o.result AS FLOAT) >= 160 THEN 'E78.5'
      WHEN o.normalized_code = '2093-3' AND CAST(o.result AS FLOAT) >= 240 THEN 'E78.2'
      ELSE NULL
    END AS suspect_icd10_code,
    CASE
      WHEN o.normalized_code = '13457-7' AND CAST(o.result AS FLOAT) >= 190 THEN 'Pure hypercholesterolemia'
      WHEN o.normalized_code = '13457-7' AND CAST(o.result AS FLOAT) >= 160 THEN 'Hyperlipidemia, unspecified'
      WHEN o.normalized_code = '2093-3' AND CAST(o.result AS FLOAT) >= 240 THEN 'Mixed hyperlipidemia'
      ELSE NULL
    END AS suspect_icd10_short_description
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code IN ('13457-7','2093-3')
    AND TRY_CAST(o.result AS FLOAT) IS NOT NULL
),
lipid_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    'condition' AS resource_type,
    CASE
      WHEN c.normalized_code IN ('E78.0','E78.00') THEN 'severe_ldl'
      WHEN c.normalized_code = 'E78.5' THEN 'moderate_ldl'
      WHEN c.normalized_code = 'E78.2' THEN 'mixed_hyperlipidemia'
      ELSE NULL
    END AS suspect_group,
    c.normalized_code AS suspect_icd10_code,
    CASE
      WHEN c.normalized_code IN ('E78.0','E78.00') THEN 'Pure hypercholesterolemia'
      WHEN c.normalized_code = 'E78.5' THEN 'Hyperlipidemia, unspecified'
      WHEN c.normalized_code = 'E78.2' THEN 'Mixed hyperlipidemia'
      ELSE NULL
    END AS suspect_icd10_short_description
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND c.normalized_code IN ('E78.0','E78.00','E78.5','E78.2')
),
all_lipid_flags AS (
  SELECT * FROM lipid_observations
  UNION ALL
  SELECT * FROM lipid_conditions
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
FROM all_lipid_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY patient_id, suspect_group;