WITH low_egfr AS (
  SELECT
    o.patient_id,
    o.observation_id AS resource_id,
    'observation' AS resource_type,
    'decreased_gfr' AS suspect_group,
    'R94.4' AS suspect_icd10_code,
    'Abnormal results of kidney function studies' AS suspect_icd10_short_description
  FROM OBSERVATION o
  WHERE
    o.normalized_code_type = 'loinc'
    AND o.normalized_code = '62319-8'
    AND TRY_CAST(o.result AS FLOAT) < 60
),
gfr_conditions AS (
  SELECT
    c.patient_id,
    c.condition_id AS resource_id,
    'condition' AS resource_type,
    'decreased_gfr' AS suspect_group,
    c.normalized_code AS suspect_icd10_code,
    'Abnormal results of kidney function studies' AS suspect_icd10_short_description
  FROM CONDITION c
  WHERE
    c.normalized_code_type = 'icd-10-cm'
    AND c.normalized_code = 'R94.4'
),
all_gfr_flags AS (
  SELECT * FROM low_egfr
  UNION ALL
  SELECT * FROM gfr_conditions
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
FROM all_gfr_flags
WHERE suspect_group IS NOT NULL
GROUP BY patient_id, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY patient_id, suspect_group;