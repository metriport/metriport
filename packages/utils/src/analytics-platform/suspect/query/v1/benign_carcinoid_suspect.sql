/* ============================================================
   BENIGN CARCINOID — SUSPECT QUERY
   (Primary: 24-hr urine 5-HIAA > 8 mg/24 h;
    Supportive: SSTR PET/CT or related procedures WITH NET/carcinoid SNOMED reason)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     • Primary strong signal: 5-HIAA (LOINC 1695-6) > 8 mg/24 h
     • Add supportive procedure evidence when CPT indicates SSTR PET/CT or
       related tumor procedures AND the SNOMED reason mentions
       "neuroendocrine" or "carcinoid" BUT NOT malignant.

   Data sources (new schemas)
     • CORE__OBSERVATION  (LOINC 1695-6)
     • CORE__CONDITION    (ICD-10 D3A.* exclusion)
     • CORE__PROCEDURE    (CPT + SNOMED reason for supportive evidence)

   Units → canonical mg/24 h:
     • mg/24 h / mg/(24.h) / mg/d → as-is
     • ignore volume-only units like “mL”

   Supportive CPT sets (examples; reason must indicate NET/carcinoid and NOT malignant):
     • SSTR PET/CT: 78812–78816; SPECT/planar 78802–78803
     • (Also allow CPT_DISPLAY to contain DOTATATE/DOTATOC/OCTREO)
     • Optional: liver-directed tumor therapy 37243; endoscopy/biopsy families
       43239, 44361–44366, 45380/381/383/385; small bowel resection 44110/44120/44160/44204/44205;
       PRRT admin 79101/79102
   ============================================================ */

WITH benign_carcinoid_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE__CONDITION c
  WHERE c.ICD_10_CM_CODE LIKE 'D3A%'
),

/* -------------------------
   PRIMARY PATH: 5-HIAA > 8 mg/24 h
   ------------------------- */
five_hiaa_raw AS (
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
  WHERE o.LOINC_CODE = '1695-6'  -- 5-HIAA [Mass/time] in 24h Urine
    AND REGEXP_SUBSTR(REPLACE(o.RESULT, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),
five_hiaa_norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.units_raw ILIKE '%mg%/24%h%'  THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%mg/(24.h)%' THEN TRY_TO_DOUBLE(r.value_token)
      WHEN r.units_raw ILIKE '%mg/d%'      THEN TRY_TO_DOUBLE(r.value_token)
      ELSE NULL
    END AS value_mg_24h,
    'mg/24 h' AS units
  FROM five_hiaa_raw r
),
five_hiaa_clean AS (
  SELECT *
  FROM five_hiaa_norm n
  WHERE n.value_mg_24h IS NOT NULL
    AND n.value_mg_24h > 0
    AND n.value_mg_24h <= 5000
    AND NOT EXISTS (
      SELECT 1 FROM benign_carcinoid_dx_exclusion x
      WHERE x.PATIENT_ID = n.PATIENT_ID
    )
),
five_hiaa_suspects AS (
  SELECT
    c.PATIENT_ID,
    'benign_carcinoid_5hiaa_gt8'              AS suspect_group,
    'D3A.8'                                    AS suspect_icd10_code,
    'Benign carcinoid tumor (screen + 5-HIAA)' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.NORMALIZED_CODE, c.NORMALIZED_DESCRIPTION,
    c.RESULT, c.units, c.value_mg_24h AS value_num, c.obs_date, c.DATA_SOURCE
  FROM five_hiaa_clean c
  WHERE c.value_mg_24h > 8
),

/* -------------------------
   SUPPORTIVE PATH: Procedure + NET/carcinoid SNOMED reason (NON-malignant)
   ------------------------- */
proc_net_reason_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                         AS resource_id,
    'Procedure'                            AS resource_type,
    p.CPT_CODE                             AS code,
    p.CPT_DISPLAY                          AS display,
    p.REASON_SNOMED_CODE                   AS reason_code,
    p.REASON_SNOMED_DISPLAY                AS reason_display,
    CAST(p.START_DATE AS DATE)             AS ev_date,
    p.DATA_SOURCE
  FROM CORE__PROCEDURE p
  WHERE
    (
      /* SSTR PET/CT + SPECT */
      p.CPT_CODE IN ('78812','78813','78814','78815','78816','78802','78803')
      /* Optional adjuncts: liver-directed therapy / endoscopy / resections / PRRT admin */
      OR p.CPT_CODE IN ('37243','43239','44361','44362','44363','44364','44365','44366',
                        '45380','45381','45383','45385',
                        '44110','44120','44160','44204','44205',
                        '79101','79102')
      /* Text catch for radiotracers */
      OR UPPER(p.CPT_DISPLAY) LIKE '%DOTATATE%'
      OR UPPER(p.CPT_DISPLAY) LIKE '%DOTATOC%'
      OR UPPER(p.CPT_DISPLAY) LIKE '%OCTREO%'
    )
    AND (
      UPPER(p.REASON_SNOMED_DISPLAY) LIKE '%NEUROENDOCRINE%'
      OR UPPER(p.REASON_SNOMED_DISPLAY) LIKE '%CARCINOID%'
    )
    /* Exclude malignant reasons for this BENIGN suspect */
    AND UPPER(p.REASON_SNOMED_DISPLAY) NOT LIKE '%MALIGNANT%'
    AND NULLIF(p.REASON_SNOMED_CODE,'') IS NOT NULL
    AND NULLIF(p.REASON_SNOMED_DISPLAY,'') IS NOT NULL
),
proc_net_reason_clean AS (
  SELECT r.*
  FROM proc_net_reason_raw r
  LEFT JOIN benign_carcinoid_dx_exclusion x
    ON x.PATIENT_ID = r.PATIENT_ID
  WHERE x.PATIENT_ID IS NULL
),
proc_net_reason_suspects AS (
  SELECT
    p.PATIENT_ID,
    'carcinoid_procedure_reason_support'         AS suspect_group,
    'D3A.8'                                      AS suspect_icd10_code,
    'Benign carcinoid tumor (supportive NET/carcinoid procedure reason)' AS suspect_icd10_short_description,
    p.resource_id, p.resource_type, p.code, p.display,
    p.reason_code, p.reason_display,
    p.ev_date AS obs_date, p.DATA_SOURCE
  FROM proc_net_reason_clean p
),

/* -------------------------
   FHIR BUILD
   ------------------------- */
obs_with_fhir AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType','Observation',
      'id',            s.resource_id,
      'status',        'final',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://loinc.org','code',s.NORMALIZED_CODE,'display',s.NORMALIZED_DESCRIPTION)
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date,'YYYY-MM-DD'),
      'valueQuantity', OBJECT_CONSTRUCT('value', s.value_num, 'unit', s.units),
      'valueString', IFF(TRY_TO_DOUBLE(REPLACE(s.RESULT,'%','')) IS NULL, s.RESULT, NULL)
    ) AS fhir,
    s.resource_id, s.resource_type, s.DATA_SOURCE AS data_source
  FROM five_hiaa_suspects s
),
proc_with_fhir AS (
  SELECT
    s.PATIENT_ID, s.suspect_group, s.suspect_icd10_code, s.suspect_icd10_short_description,
    OBJECT_CONSTRUCT(
      'resourceType','Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   s.display,
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT('system','http://www.ama-assn.org/go/cpt','code',s.code,'display',s.display)
        )
      ),
      /* Attach the SNOMED reason that made this supportive path valid */
      'reasonCode', ARRAY_CONSTRUCT(
        OBJECT_CONSTRUCT(
          'text',   s.reason_display,
          'coding', ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('system','http://snomed.info/sct','code',s.reason_code,'display',s.reason_display)
          )
        )
      ),
      'performedDateTime', TO_CHAR(s.obs_date,'YYYY-MM-DD')
    ) AS fhir,
    s.resource_id, s.resource_type, s.DATA_SOURCE AS data_source
  FROM proc_net_reason_suspects s
),

all_suspects AS (
  SELECT * FROM obs_with_fhir
  UNION ALL
  SELECT * FROM proc_with_fhir
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
      'data_source',   data_source,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM all_suspects
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
