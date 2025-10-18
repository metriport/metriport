/* ============================================================
   CANCER (HISTORY / ACTIVE) — SUSPECT QUERY
   (Procedure-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN
   Purpose
     Flag patients with evidence of cancer treatment based on:
       • Chemotherapy administration
       • Radiation therapy / treatment planning / delivery
     while EXCLUDING patients already documented with a
     malignant neoplasm diagnosis (ICD-10-CM C*) or history (Z85.*).

   Evidence (PROCEDURE):
     • Chemo admin CPT: 96401, 96402, 96409, 96411, 96413, 96415–96417,
                        96420, 96422–96423, 96425, 96440, 96446, 96450
       IV infusion/injection often used for chemo:
                        96366–96368
     • Radiation therapy families (CPT):
       - 7740x, 7741x, 7742x, 7743x     (delivery/management)
       - 7726x, 7727x, 7728x, 7729x     (planning/simulation/dosimetry)
       - 7752x                           (proton delivery)
       - Specific codes often used: 77014, 77373, 77385, 77412, 77427
     • Description keywords (case-insensitive):
       "chemotherapy", "antineoplastic", "radiation", "radiotherapy",
       "oncology", "cancer treatment"
   ============================================================ */

WITH cancer_dx_exclusion AS (
  /* Exclude patients already carrying malignant neoplasm (C*) or history (Z85.*) */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CORE__CONDITION c
  WHERE UPPER(c.ICD_10_CM_CODE) LIKE 'C%'     -- malignant neoplasms C00–C97
     OR UPPER(c.ICD_10_CM_CODE) LIKE 'Z85%'   -- personal history of malignant neoplasm
),

/* -------------------------
   RAW: pull procedure rows that look like chemo/RT
   ------------------------- */
cancer_tx_raw AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.START_DATE, p.END_DATE)         AS obs_date,

    /* code/display fields we may emit into FHIR */
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,

    /* keep usual v3 columns for completeness */
    p.BODYSITE_SNOMED_CODE       AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY    AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.CORE__PROCEDURE p
  WHERE
    (
      /* Chemotherapy administration (CPT) */
      UPPER(p.CPT_CODE) IN (
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
        '96450'   -- Chemo admin; into CNS (intrathecal), incl spinal puncture
      )

      /* IV infusion/injection codes often used for chemo adjuncts (non-chemo series) */
      OR UPPER(p.CPT_CODE) IN (
        '96366',  -- IV infusion; each additional hour (therapy/prophylaxis/diagnosis)
        '96367',  -- IV infusion; additional sequential new substance/drug up to 1 hr
        '96368'   -- IV infusion; concurrent infusion
      )

      /* Radiation therapy families (CPT) */
      OR UPPER(p.CPT_CODE) LIKE '7740%'  -- RT delivery/management family (7740x)
      OR UPPER(p.CPT_CODE) LIKE '7741%'  -- RT delivery/management family (7741x)
      OR UPPER(p.CPT_CODE) LIKE '7742%'  -- RT delivery/management family (7742x)
      OR UPPER(p.CPT_CODE) LIKE '7743%'  -- RT delivery/management family (7743x)
      OR UPPER(p.CPT_CODE) LIKE '7726%'  -- RT planning/simulation/dosimetry family (7726x)
      OR UPPER(p.CPT_CODE) LIKE '7727%'  -- RT planning/simulation/dosimetry family (7727x)
      OR UPPER(p.CPT_CODE) LIKE '7728%'  -- RT planning/simulation/dosimetry family (7728x)
      OR UPPER(p.CPT_CODE) LIKE '7729%'  -- RT planning/simulation/dosimetry family (7729x)
      OR UPPER(p.CPT_CODE) LIKE '7752%'  -- Proton beam therapy delivery family (7752x)

      /* Specific RT codes frequently used */
      OR UPPER(p.CPT_CODE) IN (
        '77014',  -- CT guidance for placement of radiation therapy fields
        '77373',  -- Stereotactic body radiation therapy (SBRT) delivery, per fraction
        '77385',  -- IMRT treatment delivery, simple
        '77412',  -- Radiation treatment delivery, superficial and/or orthovoltage
        '77427'   -- Radiation treatment management, 5 treatments
      )

      /* Description-based catch (any of CPT/SNOMED display or NOTE_TEXT) */
      OR
      (
        (
          UPPER(COALESCE(p.CPT_DISPLAY, ''))      LIKE '%CHEMOTHERAPY%'
          OR UPPER(COALESCE(p.CPT_DISPLAY, ''))   LIKE '%ANTINEOPLASTIC%'
          OR UPPER(COALESCE(p.CPT_DISPLAY, ''))   LIKE '%RADIATION%'
          OR UPPER(COALESCE(p.CPT_DISPLAY, ''))   LIKE '%RADIOTHERAPY%'
          OR UPPER(COALESCE(p.CPT_DISPLAY, ''))   LIKE '%ONCOLOGY%'
          OR UPPER(COALESCE(p.CPT_DISPLAY, ''))   LIKE '%CANCER TREATMENT%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%CHEMOTHERAPY%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%ANTINEOPLASTIC%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%RADIATION%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%RADIOTHERAPY%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%ONCOLOGY%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%CANCER TREATMENT%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))       LIKE '%CHEMOTHERAPY%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))       LIKE '%ANTINEOPLASTIC%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))       LIKE '%RADIATION%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))       LIKE '%RADIOTHERAPY%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))       LIKE '%ONCOLOGY%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))       LIKE '%CANCER TREATMENT%'
        )
        /* screen out obvious screening/assay text noise */
        AND NOT (
          UPPER(COALESCE(p.CPT_DISPLAY, ''))       LIKE '%SCREEN%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%SCREEN%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))      LIKE '%SCREEN%'
          OR UPPER(COALESCE(p.CPT_DISPLAY, ''))       LIKE '%ASSAY%'
          OR UPPER(COALESCE(p.SNOMED_DISPLAY, '')) LIKE '%ASSAY%'
          OR UPPER(COALESCE(p.NOTE_TEXT, ''))      LIKE '%ASSAY%'
        )
        /* require some non-empty description if we matched on text */
        AND (
          NULLIF(p.CPT_DISPLAY,'') IS NOT NULL
          OR NULLIF(p.SNOMED_DISPLAY,'') IS NOT NULL
          OR NULLIF(p.NOTE_TEXT,'') IS NOT NULL
        )
      )
    )
),

/* -------------------------
   NORM: pass-through
   ------------------------- */
cancer_tx_norm AS (
  SELECT * FROM cancer_tx_raw
),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
cancer_tx_clean AS (
  SELECT *
  FROM cancer_tx_norm n
  WHERE NULLIF(REASON_SNOMED_DISPLAY, '') IS NOT NULL
    AND NOT EXISTS (
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
    'cancer_treatment_history_active'                  AS suspect_group,
    'Z85.9'                                            AS suspect_icd10_code,
    'Personal history of malignant neoplasm, unspecified' AS suspect_icd10_short_description,

    /* carry-through for FHIR */
    c.resource_id,
    c.resource_type,
    c.status,
    c.obs_date,
    c.CPT_CODE,
    c.CPT_DISPLAY,
    c.SNOMED_CODE,
    c.SNOMED_DISPLAY,
    c.bodysite_snomed_code,
    c.bodysite_snomed_display,
    c.REASON_SNOMED_CODE,
    c.REASON_SNOMED_DISPLAY,
    c.NOTE_TEXT,
    c.DATA_SOURCE
  FROM cancer_tx_clean c
  WHERE c.REASON_SNOMED_DISPLAY ILIKE '%neoplasm%'
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
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Procedure',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'completed'),
      'code', OBJECT_CONSTRUCT(
        'text',   COALESCE(NULLIF(s.CPT_DISPLAY,''), NULLIF(s.SNOMED_DISPLAY,'')),
        'coding', ARRAY_CONSTRUCT_COMPACT(
          IFF(s.CPT_CODE IS NOT NULL AND s.CPT_CODE <> '',
            OBJECT_CONSTRUCT(
              'system','http://www.ama-assn.org/go/cpt',
              'code',  s.CPT_CODE,
              'display', NULLIF(s.CPT_DISPLAY,'')
            ),
            NULL
          ),
          IFF(s.SNOMED_CODE IS NOT NULL AND s.SNOMED_CODE <> '',
            OBJECT_CONSTRUCT(
              'system','http://snomed.info/sct',
              'code',  s.SNOMED_CODE,
              'display', NULLIF(s.SNOMED_DISPLAY,'')
            ),
            NULL
          )
        )
      ),
      'bodySite', IFF(s.bodysite_snomed_code IS NOT NULL AND s.bodysite_snomed_code <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(s.bodysite_snomed_display,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system','http://snomed.info/sct',
                'code',  s.bodysite_snomed_code,
                'display', NULLIF(s.bodysite_snomed_display,'')
              )
            )
          )
        ),
        NULL
      ),
      'reasonCode', IFF(s.REASON_SNOMED_CODE IS NOT NULL AND s.REASON_SNOMED_CODE <> '',
        ARRAY_CONSTRUCT(
          OBJECT_CONSTRUCT(
            'text',   NULLIF(s.REASON_SNOMED_DISPLAY,''),
            'coding', ARRAY_CONSTRUCT(
              OBJECT_CONSTRUCT(
                'system','http://snomed.info/sct',
                'code',  s.REASON_SNOMED_CODE,
                'display', NULLIF(s.REASON_SNOMED_DISPLAY,'')
              )
            )
          )
        ),
        NULL
      ),
      'note', IFF(s.NOTE_TEXT IS NOT NULL AND s.NOTE_TEXT <> '',
        ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('text', s.NOTE_TEXT)),
        NULL
      ),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
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
      'resource_type', 'Procedure',
      'data_source',   DATA_SOURCE,
      'fhir',          fhir
    )
  ) AS responsible_resources,
  CURRENT_TIMESTAMP() AS last_run
FROM cancer_tx_with_fhir
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;
