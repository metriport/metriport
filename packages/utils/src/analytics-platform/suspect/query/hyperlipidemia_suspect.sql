/* ============================================================
   HYPERLIPIDEMIA — SUSPECT QUERY (Lipid panel, mg/dL)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag "hyperlipidemia" suspects from lipid labs while excluding
     known hyperlipidemia (E78.*). Thresholds (single-observation):
       • LDL-C ≥ 130 mg/dL          → hyperlipidemia_ldl_130plus
       • Total Cholesterol ≥ 200    → hyperlipidemia_totalchol_200plus
       • Triglycerides ≥ 200        → hyperlipidemia_tg_200plus
   Notes
     • Normalize mmol/L → mg/dL (×38.67 for chol/LDL/HDL; ×88.57 for TG).
     • Keep plausible values only; then choose ONE primary suspect
       per patient with priority: LDL > Total Chol > TG.
   ============================================================ */

WITH hyperlipidemia_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND c.NORMALIZED_CODE LIKE 'E78%'
),

/* -------------------------
   RAW: pull rows, extract numeric, require units
   ------------------------- */
lipid_raw AS (
  SELECT
    lr.PATIENT_ID,
    lr.LAB_RESULT_ID                                   AS resource_id,
    'Observation'                                      AS resource_type,
    lr.NORMALIZED_CODE,
    lr.NORMALIZED_DESCRIPTION,
    lr.RESULT,
    COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) AS units_raw,
    REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(lr.RESULT_DATE AS DATE)                        AS obs_date,
    lr.DATA_SOURCE
  FROM core_v2.CORE_V2__LAB_RESULT lr
  WHERE lr.NORMALIZED_CODE_TYPE ILIKE 'loinc'
    AND lr.NORMALIZED_CODE IN (
      '2089-1',   -- LDL (direct)
      '13457-7',  -- LDL (calculated)
      '18262-6',  -- LDL (direct assay)
      '39469-2',  -- LDL (molar)
      '2093-3',   -- Total cholesterol
      '2571-8',   -- Triglycerides
      '2085-9',   -- HDL cholesterol
      '43396-1'   -- Non-HDL cholesterol
    )
    AND REGEXP_SUBSTR(REPLACE(lr.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND COALESCE(NULLIF(lr.NORMALIZED_UNITS,''), NULLIF(lr.SOURCE_UNITS,'')) IS NOT NULL
),

/* -------------------------
   NORM: convert to mg/dL and label lipid_type; set canonical units
   ------------------------- */
lipid_norm AS (
  SELECT
    r.*,
    /* lipid type classification */
    CASE
      WHEN r.NORMALIZED_CODE IN ('2089-1','13457-7','18262-6','39469-2') THEN 'LDL'
      WHEN r.NORMALIZED_CODE = '2093-3' THEN 'TOTAL_CHOL'
      WHEN r.NORMALIZED_CODE = '2571-8' THEN 'TRIGLYCERIDES'
      WHEN r.NORMALIZED_CODE = '2085-9' THEN 'HDL'
      WHEN r.NORMALIZED_CODE = '43396-1' THEN 'NON_HDL'
    END AS lipid_type,
    /* numeric normalization to mg/dL */
    CASE
      WHEN r.NORMALIZED_CODE = '2571-8' /* TG */ THEN
        CASE WHEN r.units_raw ILIKE '%mmol%' THEN TRY_TO_DOUBLE(r.value_token) * 88.57
             ELSE TRY_TO_DOUBLE(r.value_token) END
      WHEN r.NORMALIZED_CODE IN ('2093-3','2089-1','13457-7','18262-6','39469-2','2085-9','43396-1') THEN
        CASE WHEN r.units_raw ILIKE '%mmol%' THEN TRY_TO_DOUBLE(r.value_token) * 38.67
             ELSE TRY_TO_DOUBLE(r.value_token) END
      ELSE NULL
    END AS value_mg_dl,
    'mg/dL' AS units
  FROM lipid_raw r
),

/* -------------------------
   CLEAN: plausibility + exclude known dx
   ------------------------- */
lipid_clean AS (
  SELECT *
  FROM lipid_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl BETWEEN 10 AND 2000
    AND n.lipid_type IN ('LDL','TOTAL_CHOL','TRIGLYCERIDES','HDL','NON_HDL')
    AND NOT EXISTS (SELECT 1 FROM hyperlipidemia_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* CLEAN (cont.): keep the latest per patient × lipid_type */
lipid_clean_latest AS (
  SELECT *
  FROM lipid_clean
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PATIENT_ID, lipid_type
    ORDER BY obs_date DESC, resource_id DESC
  ) = 1
),

/* -------------------------
   SUSPECT: compute per-patient profile and choose ONE primary bucket
   Priority: LDL ≥130 → Total ≥200 → TG ≥200
   ------------------------- */
lipid_profile AS (
  SELECT
    PATIENT_ID,
    MAX(CASE WHEN lipid_type = 'LDL'         THEN value_mg_dl END) AS ldl_mg_dl,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL'  THEN value_mg_dl END) AS total_chol_mg_dl,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN value_mg_dl END) AS tg_mg_dl,
    MAX(CASE WHEN lipid_type = 'LDL'         THEN resource_id  END) AS ldl_res_id,
    MAX(CASE WHEN lipid_type = 'TOTAL_CHOL'  THEN resource_id  END) AS total_res_id,
    MAX(CASE WHEN lipid_type = 'TRIGLYCERIDES' THEN resource_id END) AS tg_res_id
  FROM lipid_clean_latest
  GROUP BY PATIENT_ID
),

lipid_suspects AS (
  SELECT
    p.PATIENT_ID,
    /* suspect_group selection with priority */
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
    /* pick the primary supporting resource and value */
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
   FHIR: minimal Observation for the triggering measurement
   ------------------------- */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    l.resource_id,
    l.resource_type,
    l.NORMALIZED_CODE,
    l.NORMALIZED_DESCRIPTION,
    l.RESULT,
    l.units,
    l.obs_date,
    l.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            l.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(l.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://loinc.org',
            'code',     l.NORMALIZED_CODE,
            'display',  l.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(l.obs_date, 'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT(
        'value', s.value_primary,
        'unit',  'mg/dL'
      ),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(l.RESULT,',','')) IS NULL, l.RESULT, NULL)
    ) AS fhir
  FROM lipid_suspects s
  JOIN lipid_clean_latest l
    ON l.resource_id = s.resource_id_primary
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
      'resource_type', resource_type,
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM obs_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
