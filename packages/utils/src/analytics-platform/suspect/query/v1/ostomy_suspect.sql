/* ============================================================
   OSTOMY — SUSPECT QUERY (Procedure-code based, WITH CLOSURES)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of an ostomy based on definitive
     CPT procedures, while EXCLUDING:
       • patients already documented with ostomy status (ICD-10 Z93.*)
       • signals that occur ON/AFTER a documented ostomy closure/removal

   Strong evidence sets included
     Colostomy creation:        44320, 44188, 45395
     Gastrostomy create/maint:  43246, 49440, 43762, 49450, 49451, 49452, 49446, 49465, 43763
     Tracheostomy create/maint: 31600, 31615
     Nephrostomy create/maint:  50432, 50435
     Cholecystostomy create:    47490
     Cystostomy maint:          51705   (→ new suspect group)

   Closure / removal set used to suppress later signals
     Enterostomy closure:       44227, 44620, 44626
     Tracheostomy closure:      31825
     Nephrostomy tube removal:  50389
   ============================================================ */

WITH ostomy_dx_exclusion AS (
  -- Exclude patients already carrying an ostomy status diagnosis (ICD-10 Z93.*)
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(COALESCE(c.ICD_10_CM_CODE,'')) LIKE 'Z93%'
),

/* -------------------------
   RAW: pull procedure rows (strong evidence only)
   ------------------------- */
ostomy_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                       AS resource_id,
    'Procedure'                          AS resource_type,
    p.CPT_CODE                           AS NORMALIZED_CODE,
    p.CPT_DISPLAY                        AS NORMALIZED_DESCRIPTION,
    CAST(COALESCE(p.END_DATE, p.START_DATE) AS DATE) AS obs_date,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE p.CPT_CODE IN (
    /* Colostomy */
    '44320','44188','45395',
    /* Gastrostomy (create/replace/convert/evaluate) */
    '43246','49440','43762','49450','49451','49452','49446','49465','43763',
    /* Tracheostomy (create/established) */
    '31600','31615',
    /* Nephrostomy (place/exchange) */
    '50432','50435',
    /* Cholecystostomy */
    '47490',
    /* Cystostomy (maintenance) */
    '51705'
  )
),

/* -------------------------
   NORM: (no unit normalization) pass-through
   ------------------------- */
ostomy_norm AS (
  SELECT * FROM ostomy_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
ostomy_clean AS (
  SELECT *
  FROM ostomy_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM ostomy_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   CLOSURES/REMOVALS: rows that suppress later ostomy signals
   ------------------------- */
closure_raw AS (
  SELECT
    p.PATIENT_ID,
    p.CPT_CODE,
    CAST(COALESCE(p.END_DATE, p.START_DATE) AS DATE) AS closure_date
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE p.CPT_CODE IN (
    /* Enterostomy closures */
    '44227','44620','44626',
    /* Tracheostomy closure */
    '31825',
    /* Nephrostomy tube removal */
    '50389'
  )
),

/* -------------------------
   SUSPECT: assign suspect group & ICD label, suppress if later closure/removal exists
   ------------------------- */
ostomy_suspects AS (
  SELECT
    c.PATIENT_ID,

    CASE
      WHEN c.NORMALIZED_CODE IN ('44320','44188','45395') THEN 'ostomy_colostomy'
      WHEN c.NORMALIZED_CODE IN ('43246','49440','43762','49450','49451','49452','49446','49465','43763') THEN 'ostomy_gastrostomy'
      WHEN c.NORMALIZED_CODE IN ('31615','31600') THEN 'ostomy_tracheostomy'
      WHEN c.NORMALIZED_CODE IN ('50432','50435') THEN 'ostomy_nephrostomy'
      WHEN c.NORMALIZED_CODE =  '47490' THEN 'ostomy_cholecystostomy'
      WHEN c.NORMALIZED_CODE =  '51705' THEN 'ostomy_cystostomy'
    END AS suspect_group,

    CASE
      WHEN c.NORMALIZED_CODE IN ('44320','44188','45395') THEN 'Z93.3'   -- Colostomy status
      WHEN c.NORMALIZED_CODE IN ('43246','49440','43762','49450','49451','49452','49446','49465','43763') THEN 'Z93.1' -- Gastrostomy status
      WHEN c.NORMALIZED_CODE IN ('31615','31600') THEN 'Z93.0'           -- Tracheostomy status
      WHEN c.NORMALIZED_CODE IN ('50432','50435') THEN 'Z93.6'           -- Other artificial openings of urinary tract (nephrostomy)
      WHEN c.NORMALIZED_CODE =  '47490' THEN 'Z93.49'                    -- Other artificial openings of gastrointestinal tract status
      WHEN c.NORMALIZED_CODE =  '51705' THEN 'Z93.5'                     -- Cystostomy status
    END AS suspect_icd10_code,

    CASE
      WHEN c.NORMALIZED_CODE IN ('44320','44188','45395') THEN 'Colostomy status'
      WHEN c.NORMALIZED_CODE IN ('43246','49440','43762','49450','49451','49452','49446','49465','43763') THEN 'Gastrostomy status'
      WHEN c.NORMALIZED_CODE IN ('31615','31600') THEN 'Tracheostomy status'
      WHEN c.NORMALIZED_CODE IN ('50432','50435') THEN 'Nephrostomy status'
      WHEN c.NORMALIZED_CODE =  '47490' THEN 'Cholecystostomy status'
      WHEN c.NORMALIZED_CODE =  '51705' THEN 'Cystostomy status'
    END AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.NORMALIZED_CODE,
    c.NORMALIZED_DESCRIPTION,
    c.obs_date,
    c.DATA_SOURCE
  FROM ostomy_clean c
  WHERE
    /* Suppress if a relevant closure/removal happens ON/AFTER the ostomy evidence date */
    NOT EXISTS (
      SELECT 1
      FROM closure_raw cr
      WHERE cr.PATIENT_ID = c.PATIENT_ID
        AND cr.closure_date >= c.obs_date
        AND (
          /* suppress colostomy/enterostomy signals if later enterostomy closure */
          (c.NORMALIZED_CODE IN ('44320','44188','45395')
             AND cr.CPT_CODE IN ('44227','44620','44626'))
          /* suppress tracheostomy signals if later trach closure */
          OR (c.NORMALIZED_CODE IN ('31615','31600')
             AND cr.CPT_CODE IN ('31825'))
          /* suppress nephrostomy signals if later nephrostomy tube removal */
          OR (c.NORMALIZED_CODE IN ('50432','50435')
             AND cr.CPT_CODE IN ('50389'))
        )
    )
),

/* -------------------------
   FHIR: minimal Procedure per supporting hit
   ------------------------- */
ostomy_with_fhir AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,

    s.resource_id,
    s.resource_type,
    s.NORMALIZED_CODE,
    s.NORMALIZED_DESCRIPTION,
    s.obs_date,
    s.DATA_SOURCE,

    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        'completed',
      'code', OBJECT_CONSTRUCT(
        'text',   NULLIF(s.NORMALIZED_DESCRIPTION,''),
        'coding', ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'system',  'http://www.ama-assn.org/go/cpt',
            'code',     s.NORMALIZED_CODE,
            'display',  s.NORMALIZED_DESCRIPTION
          )
        )
      ),
      'effectiveDateTime', TO_CHAR(s.obs_date, 'YYYY-MM-DD')
    ) AS fhir
  FROM ostomy_suspects s
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
      'resource_type', resource_type,  -- "Procedure"
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM ostomy_with_fhir
WHERE NULLIF(DATA_SOURCE,'') IS NOT NULL
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
