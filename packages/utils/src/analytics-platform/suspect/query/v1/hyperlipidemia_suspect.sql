/* ============================================================
   HYPERLIPIDEMIA — SUSPECT QUERY (Lipid panel + Lipid-lowering meds)
   ------------------------------------------------------------
   RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Lab thresholds (single-observation):
     • LDL-C ≥ 130 mg/dL          → hyperlipidemia_ldl_130plus
     • Total Cholesterol ≥ 200    → hyperlipidemia_totalchol_200plus
     • Triglycerides ≥ 200        → hyperlipidemia_tg_200plus

   Added path:
     • Presence of lipid-lowering meds (statins, PCSK9i, bile-acid resins, fibrates)
       → hyperlipidemia_lipidlowering_med

   Schemas used:
     • CORE__OBSERVATION, CORE__CONDITION
     • CORE_V3.CORE__MEDICATION_REQUEST, CORE_V3.CORE__MEDICATION
   ============================================================ */

WITH hyperlipidemia_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'E78%'
),

/* -------------------------
   LAB PATH (unchanged)
   ------------------------- */
lipid_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE                                                       AS NORMALIZED_CODE,
    o.LOINC_DISPLAY                                                    AS NORMALIZED_DESCRIPTION,
    o.RESULT,
    o.UNITS                                                            AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') AS value_token,
    CAST(o.START_DATE AS DATE)                                         AS obs_date,
    o.DATA_SOURCE
  FROM CORE__OBSERVATION o
  WHERE o.LOINC_CODE IN (
      '2089-1','13457-7','18262-6','39469-2', -- LDL variants
      '2093-3',                               -- Total cholesterol
      '2571-8',                               -- Triglycerides
      '2085-9',                               -- HDL
      '43396-1'                               -- Non-HDL
    )
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),
lipid_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.NORMALIZED_CODE IN ('2089-1','13457-7','18262-6','39469-2') THEN 'LDL'
      WHEN r.NORMALIZED_CODE = '2093-3' THEN 'TOTAL_CHOL'
      WHEN r.NORMALIZED_CODE = '2571-8' THEN 'TRIGLYCERIDES'
      WHEN r.NORMALIZED_CODE = '2085-9' THEN 'HDL'
      WHEN r.NORMALIZED_CODE = '43396-1' THEN 'NON_HDL'
    END AS lipid_type,
    CASE
      WHEN r.NORMALIZED_CODE = '2571-8' /* TG */ THEN
        CASE
          WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z0-9]+', '') = 'mmoll'
            THEN TRY_TO_DOUBLE(r.value_token) * 88.57
          WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z0-9]+', '') = 'mgdl'
            THEN TRY_TO_DOUBLE(r.value_token)
          ELSE NULL
        END
      WHEN r.NORMALIZED_CODE IN ('2093-3','2089-1','13457-7','18262-6','39469-2','2085-9','43396-1') THEN
        CASE
          WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z0-9]+', '') = 'mmoll'
            THEN TRY_TO_DOUBLE(r.value_token) * 38.67
          WHEN REGEXP_REPLACE(LOWER(r.units_raw), '[^a-z0-9]+', '') = 'mgdl'
            THEN TRY_TO_DOUBLE(r.value_token)
          ELSE NULL
        END
      ELSE NULL
    END AS value_mg_dl,
    'mg/dL' AS units
  FROM lipid_raw r
),
lipid_clean AS (
  SELECT *
  FROM lipid_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl BETWEEN 10 AND 2000
    AND n.lipid_type IN ('LDL','TOTAL_CHOL','TRIGLYCERIDES','HDL','NON_HDL')
    AND NOT EXISTS (SELECT 1 FROM hyperlipidemia_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),
lipid_clean_latest AS (
  SELECT *
  FROM lipid_clean
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PATIENT_ID, lipid_type
    ORDER BY obs_date DESC, resource_id DESC
  ) = 1
),
lipid_profile AS (
  SELECT
    PATIENT_ID,
    MAX(CASE WHEN lipid_type = 'LDL'            THEN value_mg_dl END) AS ldl_mg_dl,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL'     THEN value_mg_dl END) AS total_chol_mg_dl,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES'  THEN value_mg_dl END) AS tg_mg_dl,
    MAX(CASE WHEN lipid_type = 'LDL'            THEN resource_id  END) AS ldl_res_id,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL'     THEN resource_id  END) AS total_res_id,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES'  THEN resource_id  END) AS tg_res_id
  FROM lipid_clean_latest
  GROUP BY PATIENT_ID
),
lipid_suspects AS (
  SELECT
    p.PATIENT_ID,
    CASE
      WHEN p.ldl_mg_dl        >= 130 THEN 'hyperlipidemia_ldl_130plus'
      WHEN p.total_chol_mg_dl >= 200 THEN 'hyperlipidemia_totalchol_200plus'
      WHEN p.tg_mg_dl         >= 200 THEN 'hyperlipidemia_tg_200plus'
      ELSE NULL
    END AS suspect_group,
    CASE
      WHEN p.ldl_mg_dl        >= 130 THEN 'E78.0'
      WHEN p.total_chol_mg_dl >= 200 THEN 'E78.5'
      WHEN p.tg_mg_dl         >= 200 THEN 'E78.1'
      ELSE NULL
    END AS suspect_icd10_code,
    CASE
      WHEN p.ldl_mg_dl        >= 130 THEN 'Pure hypercholesterolemia (LDL ≥130)'
      WHEN p.total_chol_mg_dl >= 200 THEN 'Hyperlipidemia, unspecified (Total ≥200)'
      WHEN p.tg_mg_dl         >= 200 THEN 'Hypertriglyceridemia (TG ≥200)'
      ELSE NULL
    END AS suspect_icd10_short_description,
    CASE
      WHEN p.ldl_mg_dl        >= 130 THEN p.ldl_res_id
      WHEN p.total_chol_mg_dl >= 200 THEN p.total_res_id
      WHEN p.tg_mg_dl         >= 200 THEN p.tg_res_id
    END AS resource_id_primary,
    CASE
      WHEN p.ldl_mg_dl        >= 130 THEN p.ldl_mg_dl
      WHEN p.total_chol_mg_dl >= 200 THEN p.total_chol_mg_dl
      WHEN p.tg_mg_dl         >= 200 THEN p.tg_mg_dl
    END AS value_primary
  FROM lipid_profile p
  WHERE (p.ldl_mg_dl >= 130 OR p.total_chol_mg_dl >= 200 OR p.tg_mg_dl >= 200)
),

/* -------------------------
   MEDICATION PATH (MedicationRequest only)
   ------------------------- */
med_request_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                   AS resource_id,
    'MedicationRequest'                        AS resource_type,
    m.RXNORM_CODE                              AS code,
    COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)  AS display,
    CAST(mr.AUTHORED_ON AS DATE)               AS ev_date,
    mr.DATA_SOURCE
  FROM CORE_V3.CORE__MEDICATION_REQUEST mr
  JOIN CORE_V3.CORE__MEDICATION m ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE mr.AUTHORED_ON IS NOT NULL
    AND (
      /* Statins */
      LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) REGEXP '(atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|fluvastatin|pitavastatin|lipitor|crestor|zocor|pravachol|altoprev|lescol|livalo)'
      /* PCSK9 inhibitors + inclisiran */
      OR LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) REGEXP '(evolocumab|alirocumab|inclisiran|repatha|praluent|leqvio)'
      /* Bile-acid sequestrants / resins */
      OR LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) REGEXP '(cholestyramine|colesevelam|colestipol|questran|prevalite|welchol|colestid)'
      /* Fibrates */
      OR LOWER(COALESCE(m.RXNORM_DISPLAY, m.NDC_DISPLAY)) REGEXP '(fenofibrate|fenofibric|gemfibrozil|bezafibrate|ciprofibrate|tricor|trilipix|antara|lofibra|fibricor|lopid)'
    )
),
/* de-dupe: same patient + day + drug display */
med_request_dedup AS (
  SELECT *
  FROM (
    SELECT
      r.*,
      ROW_NUMBER() OVER (
        PARTITION BY r.PATIENT_ID, r.ev_date, LOWER(COALESCE(r.display,''))
        ORDER BY r.resource_id
      ) AS rn
    FROM med_request_raw r
    LEFT JOIN hyperlipidemia_dx_exclusion x ON x.PATIENT_ID = r.PATIENT_ID
    WHERE x.PATIENT_ID IS NULL
  )
  WHERE rn = 1
),
med_suspects AS (
  SELECT
    m.PATIENT_ID,
    'hyperlipidemia_lipidlowering_med'      AS suspect_group,
    'E78.5'                                 AS suspect_icd10_code,
    'Hyperlipidemia, unspecified (lipid-lowering medication)' AS suspect_icd10_short_description,
    m.resource_id,
    m.resource_type,
    m.code                                   AS NORMALIZED_CODE,
    m.display                                AS NORMALIZED_DESCRIPTION,
    NULL AS RESULT,
    NULL AS units,
    NULL AS value_num,
    m.ev_date                                AS obs_date,
    m.DATA_SOURCE
  FROM med_request_dedup m
),

/* -------------------------
   FHIR
   ------------------------- */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    l.resource_id, l.resource_type, l.NORMALIZED_CODE, l.NORMALIZED_DESCRIPTION,
    l.RESULT, l.units, l.obs_date, l.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType','Observation',
      'id',            l.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(l.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',l.NORMALIZED_CODE,'display',l.NORMALIZED_DESCRIPTION)
        )
      ),
      'effectiveDateTime', TO_CHAR(l.obs_date,'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT('value', s.value_primary, 'unit', 'mg/dL'),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(l.RESULT,',','')) IS NULL, l.RESULT, NULL)
    ) AS fhir
  FROM lipid_suspects s
  JOIN lipid_clean_latest l
    ON l.resource_id = s.resource_id_primary
),
med_with_fhir AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    s.resource_id, s.resource_type, s.NORMALIZED_CODE, s.NORMALIZED_DESCRIPTION,
    s.RESULT, s.units, s.obs_date, s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType',  'MedicationRequest',
      'id',            s.resource_id,
      'status',        'active',
      'intent',        'order',
      'medicationCodeableConcept', OBJECT_CONSTRUCT(
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.nlm.nih.gov/research/umls/rxnorm','code',s.NORMALIZED_CODE,'display',s.NORMALIZED_DESCRIPTION)
        ),
        'text', s.NORMALIZED_DESCRIPTION
      ),
      'authoredOn', TO_CHAR(s.obs_date,'YYYY-MM-DD')
    ) AS fhir
  FROM med_suspects s
),

all_with_fhir AS (
  SELECT * FROM obs_with_fhir
  UNION ALL
  SELECT * FROM med_with_fhir
)

/* -------------------------
   RETURN
   ------------------------- */
SELECT
  PATIENT_ID,
  suspect_group,
  suspect_icd10_code,
  suspect_icd10_short_description,
  ARRAY_AGG(OBJECT_CONSTRUCT(
      'id',            resource_id,
      'resource_type', resource_type,
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
  )) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM all_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
