/* ============================================================
   CANCER (HISTORY / ACTIVE) — SUSPECT QUERY
   (Procedure-code based, with EXCLUSION)
   ------------------------------------------------------------
   Standard flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of cancer treatment based on:
       • Chemotherapy administration
       • Radiation therapy / treatment planning / delivery
     while EXCLUDING patients already documented with a
     malignant neoplasm diagnosis (ICD-10-CM C* or Z85.*).

   Evidence (PROCEDURE):
     • Chemo admin CPT: 96401, 96402, 96409, 96411, 96413, 96415,
                        96416, 96417, 96420, 96422, 96423, 96425,
                        96440, 96446, 96450
       IV infusion/injection often used for chemo:
                        96366, 96367, 96368,
     • Radiation therapy patterns:
       - LIKE '7740%', '7741%', '7742%', '7743%'     (delivery/management)
       - LIKE '7726%', '7727%', '7728%', '7729%'     (planning)
       - LIKE '7752%'                                (proton)
       - Specific codes frequently used in RT: 77014, 77373, 77385, 77412, 77427
     • Description keywords (case-insensitive):
       "chemotherapy", "antineoplastic", "radiation", "radiotherapy",
       "oncology", "cancer treatment"
   ============================================================ */

WITH cancer_dx_exclusion AS (
  -- Exclude patients already carrying a malignant neoplasm dx (ICD-10 C*) or
  -- personal history of malignant neoplasm (Z85.*)
  SELECT DISTINCT
    c.PATIENT_ID
  FROM core_v2.CORE_V2__CONDITION c
  WHERE c.NORMALIZED_CODE_TYPE = 'icd-10-cm'
    AND (
      c.NORMALIZED_CODE ILIKE 'C%'    -- malignant neoplasms C00–C97
      OR c.NORMALIZED_CODE ILIKE 'Z85%' -- personal history of malignant neoplasm
    )
),

/* ------------------------- 
   RAW: pull procedure rows
   ------------------------- */
cancer_tx_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                                    AS resource_id,
    'Procedure'                                       AS resource_type,
    COALESCE(NULLIF(p.NORMALIZED_CODE_TYPE,''), p.SOURCE_CODE_TYPE) AS code_system_raw,
    p.NORMALIZED_CODE                                 AS normalized_code,
    p.NORMALIZED_DESCRIPTION                          AS normalized_description,
    CAST(p.PROCEDURE_DATE AS DATE)                    AS obs_date,
    p.DATA_SOURCE
  FROM core_v2.CORE_V2__PROCEDURE p
  WHERE
    (
      /* Chemotherapy administration (CPT) */
      p.NORMALIZED_CODE IN ( 
        '96401',  -- Chemo admin; SC/IM, non-hormonal
        '96402',  -- Chemo admin; SC/IM, hormonal
        '96409',  -- Chemo admin; IV push, initial
        '96411',  -- Chemo admin; IV push, each additional substance/drug
        '96413',  -- Chemo admin; IV infusion, up to 1 hr, initial
        '96415',  -- Chemo admin; IV infusion, each additional hour
        '96416',  -- Chemo admin; start prolonged infusion (>8 hr) with pump
        '96417',  -- Chemo admin; each additional sequential infusion, up to 1 hr
        '96420',  -- Chemo admin; intra-arterial, push
        '96422',  -- Chemo admin; intra-arterial infusion, up to 1 hr
        '96423',  -- Chemo admin; intra-arterial infusion, each additional hour
        '96425',  -- Chemo admin; intra-arterial infusion via portable/implantable pump
        '96440',  -- Chemo admin; into pleural/peritoneal cavity via tube/catheter
        '96446',  -- Chemo admin; intraperitoneal via indwelling port/catheter
        '96450'  -- Chemo admin; into CNS (intrathecal), incl spinal puncture
      )


      OR

      /* Radiation therapy families (CPT/HCPCS) */
      p.NORMALIZED_CODE LIKE '7740%' OR
      p.NORMALIZED_CODE LIKE '7741%' OR
      p.NORMALIZED_CODE LIKE '7742%' OR
      p.NORMALIZED_CODE LIKE '7743%' OR
      p.NORMALIZED_CODE LIKE '7726%' OR
      p.NORMALIZED_CODE LIKE '7727%' OR
      p.NORMALIZED_CODE LIKE '7728%' OR
      p.NORMALIZED_CODE LIKE '7729%' OR
      p.NORMALIZED_CODE LIKE '7752%'

      OR

      /* Specific RT codes frequently used */
      p.NORMALIZED_CODE IN ('77014','77373','77385','77412','77427')

      OR

      /* Description-based catch (case-insensitive) */
      LOWER(p.NORMALIZED_DESCRIPTION) LIKE '%chemotherapy%'     OR
      LOWER(p.NORMALIZED_DESCRIPTION) LIKE '%antineoplastic%'   OR
      LOWER(p.NORMALIZED_DESCRIPTION) LIKE '%radiation%'        OR
      LOWER(p.NORMALIZED_DESCRIPTION) LIKE '%radiotherapy%'     OR
      LOWER(p.NORMALIZED_DESCRIPTION) LIKE '%oncology%'         OR
      LOWER(p.NORMALIZED_DESCRIPTION) LIKE '%cancer treatment%'
    )
    AND LOWER(p.NORMALIZED_DESCRIPTION) NOT LIKE '%screen%'
    AND LOWER(p.NORMALIZED_DESCRIPTION) NOT LIKE '%assay%'
    AND NULLIF(p.NORMALIZED_DESCRIPTION, '') IS NOT NULL
),

/* -------------------------
   NORM: (no normalization needed) pass-through
   ------------------------- */
cancer_tx_norm AS (
  SELECT
    PATIENT_ID,
    resource_id,
    resource_type,
    code_system_raw,
    normalized_code,
    normalized_description,
    obs_date,
    DATA_SOURCE
  FROM cancer_tx_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
cancer_tx_clean AS (
  SELECT
    *
  FROM cancer_tx_norm n
  WHERE NOT EXISTS (
    SELECT 1
    FROM cancer_dx_exclusion x
    WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label
   ------------------------- */
cancer_tx_suspects AS (
  SELECT
    c.PATIENT_ID,
    'cancer_treatment_history_active'     AS suspect_group,
    'Z85.9'                                AS suspect_icd10_code,
    'Personal history of malignant neoplasm, unspecified' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.code_system_raw,
    c.normalized_code,
    c.normalized_description,
    c.obs_date,
    c.DATA_SOURCE
  FROM cancer_tx_clean c
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
cancer_tx_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.normalized_code,
    s.normalized_description,
    s.obs_date,
    s.DATA_SOURCE,

    /* Map coding system by code_system_raw for FHIR */
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.normalized_description,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',
              CASE
                WHEN LOWER(s.code_system_raw) = 'cpt'        THEN 'http://www.ama-assn.org/go/cpt'
                WHEN LOWER(s.code_system_raw) = 'hcpcs'      THEN 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'
                WHEN LOWER(s.code_system_raw) = 'snomed-ct'  THEN 'http://snomed.info/sct'
                WHEN LOWER(s.code_system_raw) = 'loinc'      THEN 'http://loinc.org'
                ELSE NULL
              END,
            'code',     s.normalized_code,
            'display',  s.normalized_description
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM cancer_tx_suspects s
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
      'resource_type', resource_type,   -- "Procedure"
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM cancer_tx_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
