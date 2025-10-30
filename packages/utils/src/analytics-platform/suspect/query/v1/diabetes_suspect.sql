/* ============================================================
   DIABETES — SUSPECT QUERY (Glucose, HbA1c, or Glucose-Lowering Rx)
   ------------------------------------------------------------
   • Glucose units: mg/dL|mmol/L only; fasting only (1558-6, or 2345-7 with "fast")
   • Adds Medication path for glucose-lowering drugs (excludes metformin-only,
     excludes weight-loss-only GLP-1/tirzepatide).
   ============================================================ */

WITH dm_dx_exclusion AS (
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE LEFT(c.ICD_10_CM_CODE, 3) IN ('E08','E09','E10','E11','E13')
),

/* -------------------------
   RAW
   ------------------------- */
glucose_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                            AS RESULT,
    o.UNITS                                                            AS units_raw,
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE
    (
      o.LOINC_CODE = '1558-6'  -- fasting glucose
      OR (
        o.LOINC_CODE = '2345-7' -- generic serum/plasma glucose
        AND (UPPER(o.LOINC_DISPLAY) LIKE '%FAST%' OR UPPER(o.VALUE) LIKE '%FAST%')
      )
    )
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
    AND NULLIF(o.UNITS,'') IS NOT NULL
),

hba1c_raw AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                                                   AS resource_id,
    'Observation'                                                      AS resource_type,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                                            AS RESULT,
    o.UNITS                                                            AS units_raw,  -- must be '%'
    REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+')  AS value_token,
    CAST(o.EFFECTIVE_DATE AS DATE)                                     AS obs_date,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE o.LOINC_CODE = '4548-4'   -- HbA1c
    AND NULLIF(o.UNITS,'') = '%'
    AND REGEXP_SUBSTR(REPLACE(o.VALUE, ',', ''), '[-+]?[0-9]*\\.?[0-9]+') IS NOT NULL
),

/* -------------------------
   NORM
   ------------------------- */
glucose_norm AS (
  SELECT
    r.*,
    REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') AS units_key,
    CASE
      WHEN REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') = 'mgdl'
        THEN TRY_TO_DOUBLE(r.value_token)
      WHEN REGEXP_REPLACE(LOWER(COALESCE(r.units_raw,'')), '[^a-z0-9]+', '') = 'mmoll'
        THEN TRY_TO_DOUBLE(r.value_token) * 18.0182
      ELSE NULL
    END AS value_mg_dl,
    'mg/dL' AS units
  FROM glucose_raw r
),

hba1c_norm AS (
  SELECT
    r.*,
    TRY_TO_DOUBLE(r.value_token) AS value_pct,
    '%' AS units
  FROM hba1c_raw r
),

/* -------------------------
   CLEAN
   ------------------------- */
glucose_clean AS (
  SELECT *
  FROM glucose_norm n
  WHERE n.value_mg_dl IS NOT NULL
    AND n.value_mg_dl > 0
    AND n.value_mg_dl <= 1000
    AND NOT EXISTS (SELECT 1 FROM dm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

hba1c_clean AS (
  SELECT *
  FROM hba1c_norm n
  WHERE n.value_pct IS NOT NULL
    AND n.value_pct > 0
    AND n.value_pct <= 20
    AND NOT EXISTS (SELECT 1 FROM dm_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID)
),

/* -------------------------
   SUSPECT (Observations)
   ------------------------- */
glucose_suspects AS (
  SELECT
    c.PATIENT_ID,
    CASE
      WHEN c.value_mg_dl >= 200 THEN 'diabetes_glucose_200plus'
      WHEN c.value_mg_dl BETWEEN 126 AND 199 THEN 'diabetes_fpg_126_199'
      ELSE NULL
    END AS suspect_group,
    'E11.9' AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT, c.units,
    c.value_mg_dl AS value_num, c.obs_date, c.DATA_SOURCE
  FROM glucose_clean c
  WHERE c.value_mg_dl >= 126
),

hba1c_suspects AS (
  SELECT
    c.PATIENT_ID,
    'diabetes_hba1c_6p5plus' AS suspect_group,
    'E11.9' AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,
    c.resource_id, c.resource_type, c.LOINC_CODE, c.LOINC_DISPLAY, c.RESULT, c.units,
    c.value_pct AS value_num, c.obs_date, c.DATA_SOURCE
  FROM hba1c_clean c
  WHERE c.value_pct >= 6.5
),

/* ============================================================
   MEDICATION PATH (MedicationRequest + Medication)
   ============================================================ */
dm_rx_raw AS (
  SELECT
    mr.PATIENT_ID,
    mr.MEDICATION_REQUEST_ID                         AS resource_id,
    'MedicationRequest'                              AS resource_type,
    COALESCE(NULLIF(mr.STATUS,''), 'active')         AS status,
    mr.AUTHORED_ON                                   AS obs_date,
    m.RXNORM_CODE,
    m.RXNORM_DISPLAY,
    mr.DATA_SOURCE
  FROM CORE_V3.MEDICATION_REQUEST mr
  JOIN CORE_V3.MEDICATION m
    ON m.MEDICATION_ID = mr.MEDICATION_ID
  WHERE m.RXNORM_CODE IN (
    /* alpha-glucosidase inhibitors */
    '213170','151826','199150','200132','199149','205329','205330',
    /* DPP-4s & combos */
    '1372738','861771','861821','1243833','1243843','1243848','2709477',
    '638596','665036','665040','665044','1372706','1243026','1243033','1243040',
    '1796091','1796096','1368398','1100699','1100703','1100706','1368001','1368006',
    '1368018','1368034','1368007','1368385','1368392','1368424','858037','858044',
    '858040','1043567','1043563','1043570','1043578','665033','665038','665042',
    '861769','861819','2709488','2709491','2709603','1189803',
    /* SGLT2s & combos */
    '1373469','1373473','1545156','1545163','1545166','1545150','1545161','1373463','1373471',
    '1488564','1488569','1488574','1486977','1486981','1593058','1593070','1593072',
    '1925498','2169274','1593775','1593835','1940498','1593833','1593831',
    '1545659','1545658','1545664','1545666','1545668','1602109','1602118',
    '2359279','2359351','1665369','1664325','1664328','1664321',
    '1862688','1862692','1862697','1862701','1862691','1862695','1862700','1664326','1664315',
    '1992816','1992821','1992700','1486972','1602110','1602115','1602120',
    /* Sulfonylureas & combos */
    '153843','153591','153845','199245','199246','199247','25789','153592',
    '4821','203680','205828','865568','865571','865573','310488','310489','314006',
    '379804','352381','861731','861736','861740','4815','197737','314000',
    '310534','310536','310537','310539','861743','861748','861753','198293',
    '647237','647239','706895',
    /* TZDs & combos */
    '261442','261266','261267','261268','317573','312440','312441','861785','861824',
    '607999','312860','312861','861806','861763',
    /* Meglitinides & combos */
    '219335','200256','200257','200258','311919','314142','802646',
    /* Insulins (all forms) */
    '1926331','1604539','1653198','1653202','1986356','1653204','1670011','1670016','1670021',
    '847241','1859000','1736863','847232','2002419','2002420','2563971','2563973','847199',
    '847189','1652646','1652639','1992171','1652640','1652242','2206092','1986350','731281',
    '1652647','1654857','92881','285018','274783','2377134','86009','242120','1992169','51428',
    '400560','1372723','284810','1604540','1604544','1372741','311040','1653196','351297',
    '847191','1670007','1860167','2107520','139825','484322','847239','1858995','311041',
    '847230','2268064','2589008','2563976','485210','847259','1605101','311028','1654862',
    '1008501','311027','245265','847187','311052','816726','865098','1652239','260265',
    '847211','259111','847252','2206090','311048','253182','311036','1543207','249220',
    '1731315','2179744','311034'
  )
),

dm_rx_clean AS (
  SELECT *
  FROM dm_rx_raw r
  WHERE NOT EXISTS (SELECT 1 FROM dm_dx_exclusion x WHERE x.PATIENT_ID = r.PATIENT_ID)
    AND NULLIF(r.DATA_SOURCE,'') IS NOT NULL
    AND NULLIF(r.RXNORM_DISPLAY, '') IS NOT NULL
),

diabetes_rx AS (
  SELECT
    r.PATIENT_ID,
    'diabetes_glucose_lowering_rx' AS suspect_group,
    'E11.9' AS suspect_icd10_code,
    'Type 2 diabetes mellitus without complications' AS suspect_icd10_short_description,
    r.resource_id,
    r.resource_type,
    /* Observation-only fields null for Rx path */
    NULL AS LOINC_CODE, NULL AS LOINC_DISPLAY, NULL AS RESULT, NULL AS units, NULL AS value_num,
    r.obs_date, r.DATA_SOURCE,
    r.RXNORM_CODE, r.RXNORM_DISPLAY
  FROM dm_rx_clean r
),

/* -------------------------
   UNION ALL SUSPECTS (align column counts)
   ------------------------- */
dm_suspects AS (
  SELECT
    PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description,
    resource_id, resource_type, LOINC_CODE, LOINC_DISPLAY, RESULT, units, value_num, obs_date, DATA_SOURCE,
    NULL AS RXNORM_CODE, NULL AS RXNORM_DISPLAY
  FROM glucose_suspects
  WHERE suspect_group IS NOT NULL

  UNION ALL
  SELECT
    PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description,
    resource_id, resource_type, LOINC_CODE, LOINC_DISPLAY, RESULT, units, value_num, obs_date, DATA_SOURCE,
    NULL AS RXNORM_CODE, NULL AS RXNORM_DISPLAY
  FROM hba1c_suspects
  WHERE suspect_group IS NOT NULL

  UNION ALL
  SELECT
    PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description,
    resource_id, resource_type, LOINC_CODE, LOINC_DISPLAY, RESULT, units, value_num, obs_date, DATA_SOURCE,
    RXNORM_CODE, RXNORM_DISPLAY
  FROM diabetes_rx
),

/* -------------------------
   FHIR: Observation or MedicationRequest (minimal; zod-safe)
   ------------------------- */
dm_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    CASE
      WHEN s.resource_type = 'Observation' THEN
        OBJECT_CONSTRUCT(
          'resourceType', 'Observation',
          'id',            s.resource_id,
          'status',        'final',
          'code', OBJECT_CONSTRUCT(
            'text',   NULLIF(s.LOINC_DISPLAY,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system',  'http://loinc.org',
                'code',     s.LOINC_CODE,
                'display',  NULLIF(s.LOINC_DISPLAY,'')
              )
            )
          ),
          'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL),
          'valueQuantity', OBJECT_CONSTRUCT(
            'value', s.value_num,
            'unit',  s.units
          )
        )
      ELSE
        OBJECT_CONSTRUCT(
          'resourceType', 'MedicationRequest',
          'id',            s.resource_id,
          'status',        'active',
          'intent',        'order',
          'authoredOn',    IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL),
          'medicationCodeableConcept', OBJECT_CONSTRUCT(
            'text',   NULLIF(s.RXNORM_DISPLAY,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system',  'http://www.nlm.nih.gov/research/umls/rxnorm',
                'code',     s.RXNORM_CODE,
                'display',  NULLIF(s.RXNORM_DISPLAY,'')
              )
            )
          )
        )
    END AS fhir,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE AS data_source
  FROM dm_suspects s
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
FROM dm_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
