/* ============================================================
   SEIZURE DISORDER / EPILEPSY — SUSPECT QUERY
   (Procedure/Observation-based, with EXCLUSION)
   ------------------------------------------------------------
   Flow: RAW → NORM → CLEAN → SUSPECT → FHIR → RETURN

   Purpose
     Flag patients with evidence consistent with an ACTIVE seizure disorder,
     supported by:
       • EEG procedures, OR
       • Anti-epileptic drug (AED) administration (parenteral), OR
       • EEG study documents (LOINC),
     and THEN require seizure/epilepsy context at SUSPECT.

   Exclusion (diagnosis-based; ICD-10-CM stored WITHOUT dots):
     • Z8669  = Personal history of other diseases of the nervous system/sense organs
     • G40*   = Epilepsy and recurrent seizures
     • G41*   = Status epilepticus

   Notes
     - Uses CORE_V3.CONDITION, CORE_V3.PROCEDURE, CORE_V3.OBSERVATION.
     - Column “BODYSITE_SNOMED_CODE” name preserved from schema.
   ============================================================ */

WITH seizure_dx_exclusion AS (
  /* Patients already carrying a “history of” or active epilepsy/status dx */
  SELECT DISTINCT c.PATIENT_ID
  FROM CORE_V3.CONDITION c
  WHERE
    UPPER(c.ICD_10_CM_CODE) IN (
      'Z8669'  -- Personal history of other diseases of the nervous system & sense organs
    )
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'G40%'  -- Epilepsy and recurrent seizures
    OR UPPER(c.ICD_10_CM_CODE) LIKE 'G41%'  -- Status epilepticus
),

/* -------------------------
   RAW A: EEG procedures (codes only)
   ------------------------- */
raw_eeg_proc AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.PERFORMED_DATE, p.END_DATE)         AS obs_date,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      '95812',  -- EEG extended; 41–60 min
      '95813',  -- EEG extended; >60 min
      '95816',  -- EEG; 20–40 min
      '95819',  -- EEG; >40 min
      '95822'   -- EEG in sleep or coma; 20–40 min
    )
    OR UPPER(p.SNOMED_CODE) IN (
      '54640009',  -- Electroencephalogram (procedure)
      '252721009', -- Scalp EEG
      '252735006', -- Ambulatory EEG
      '18648009',  -- Sleep EEG
      '252738008'  -- Video EEG
    )
),

/* -------------------------
   RAW B: Anti-epileptic drug administration (codes only)
   ------------------------- */
raw_aed_admin AS (
  SELECT
    p.PATIENT_ID,
    p.PROCEDURE_ID                             AS resource_id,
    'Procedure'                                AS resource_type,
    COALESCE(NULLIF(p.STATUS,''), 'completed') AS status,
    COALESCE(p.PERFORMED_DATE, p.END_DATE)         AS obs_date,
    p.CPT_CODE,
    p.CPT_DISPLAY,
    p.SNOMED_CODE,
    p.SNOMED_DISPLAY,
    p.BODYSITE_SNOMED_CODE                      AS bodysite_snomed_code,
    p.BODYSITE_SNOMED_DISPLAY                  AS bodysite_snomed_display,
    p.REASON_SNOMED_CODE,
    p.REASON_SNOMED_DISPLAY,
    p.NOTE_TEXT,
    p.DATA_SOURCE
  FROM CORE_V3.PROCEDURE p
  WHERE
    UPPER(p.CPT_CODE) IN (
      'J1953'  -- Injection, levetiracetam, 10 mg (IV Keppra)
    )
),

/* -------------------------
   RAW C: EEG Observations (document-type)
   ------------------------- */
raw_eeg_obs AS (
  SELECT
    o.PATIENT_ID,
    o.OBSERVATION_ID                           AS resource_id,
    'Observation'                              AS resource_type,
    COALESCE(NULLIF(o.STATUS,''), 'final')     AS status,
    COALESCE(o.EFFECTIVE_DATE, o.END_DATE)     AS obs_date,
    o.LOINC_CODE,
    o.LOINC_DISPLAY,
    o.VALUE                                    AS RESULT,
    o.UNITS,
    o.NOTE_TEXT,
    o.DATA_SOURCE
  FROM CORE_V3.OBSERVATION o
  WHERE UPPER(o.LOINC_CODE) IN (
    '11523-8',  -- EEG study
    '92050-4'   -- Video EEG study
  )
),

/* -------------------------
   RAW: union PROCEDURE paths (no context yet)
   ------------------------- */
seizure_raw AS (
  SELECT * FROM raw_eeg_proc
  UNION ALL
  SELECT * FROM raw_aed_admin
),

/* Observation path separate for FHIR */
eeg_obs_norm AS (SELECT * FROM raw_eeg_obs),

/* -------------------------
   NORM: pass-through
   ------------------------- */
seizure_norm AS (SELECT * FROM seizure_raw),

/* -------------------------
   CLEAN: apply diagnosis exclusions
   ------------------------- */
seizure_clean AS (
  SELECT *
  FROM seizure_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM seizure_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),
eeg_obs_clean AS (
  SELECT *
  FROM eeg_obs_norm n
  WHERE NOT EXISTS (
    SELECT 1 FROM seizure_dx_exclusion x WHERE x.PATIENT_ID = n.PATIENT_ID
  )
),

/* -------------------------
   SUSPECT: require explicit seizure/epilepsy context
   - PROCEDURE: SNOMED reason anchors or seizure/epilep* text
   - OBSERVATION: seizure/epilep* text in note/result/display
   Also select G41 (status) when text/codes indicate status epilepticus.
   ------------------------- */
seizure_suspects_proc AS (
  SELECT
    c.PATIENT_ID,
    'seizure_disorder' AS suspect_group,

    /* Pick G41 when status epilepticus is indicated; else G40 */
    CASE
      WHEN UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%STATUS EPILEPTICUS%'
        OR UPPER(c.NOTE_TEXT) LIKE '%STATUS EPILEPTICUS%'
        OR UPPER(c.REASON_SNOMED_CODE) IN ('230572002')  -- Status epilepticus (disorder)
      THEN 'G41'
      ELSE 'G40'
    END AS suspect_icd10_code,

    CASE
      WHEN UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%STATUS EPILEPTICUS%'
        OR UPPER(c.NOTE_TEXT) LIKE '%STATUS EPILEPTICUS%'
        OR UPPER(c.REASON_SNOMED_CODE) IN ('230572002')
      THEN 'Status epilepticus'
      ELSE 'Epilepsy and recurrent seizures'
    END AS suspect_icd10_short_description,

    /* carry-through for FHIR (Procedure) */
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
  FROM seizure_clean c
  WHERE
    UPPER(c.REASON_SNOMED_CODE) IN (
      '91175000',   -- Seizure (finding)
      '128613002',  -- Seizure disorder (disorder)
      '84757009',   -- Epilepsy (disorder)
      '230572002'   -- Status epilepticus (disorder)
    )
    OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%SEIZURE%'
    OR UPPER(c.REASON_SNOMED_DISPLAY) LIKE '%EPILEP%'
    OR UPPER(c.SNOMED_DISPLAY)        LIKE '%SEIZURE%'
    OR UPPER(c.SNOMED_DISPLAY)        LIKE '%EPILEP%'
    OR UPPER(c.NOTE_TEXT)             LIKE '%SEIZURE%'
    OR UPPER(c.NOTE_TEXT)             LIKE '%EPILEP%'
),

seizure_suspects_obs AS (
  SELECT
    n.PATIENT_ID,
    'seizure_disorder' AS suspect_group,

    CASE
      WHEN UPPER(n.NOTE_TEXT) LIKE '%STATUS EPILEPTICUS%'
        OR UPPER(n.RESULT) LIKE '%STATUS EPILEPTICUS%'
      THEN 'G41'
      ELSE 'G40'
    END AS suspect_icd10_code,

    CASE
      WHEN UPPER(n.NOTE_TEXT) LIKE '%STATUS EPILEPTICUS%'
        OR UPPER(n.RESULT) LIKE '%STATUS EPILEPTICUS%'
      THEN 'Status epilepticus'
      ELSE 'Epilepsy and recurrent seizures'
    END AS suspect_icd10_short_description,

    /* carry-through for FHIR (Observation) */
    n.resource_id,
    n.resource_type,
    n.status,
    n.obs_date,
    /* Map LOINC into generic slots for FHIR builder */
    NULL            AS CPT_CODE,
    NULL            AS CPT_DISPLAY,
    NULL            AS SNOMED_CODE,
    NULL            AS SNOMED_DISPLAY,
    NULL            AS bodysite_snomed_code,
    NULL            AS bodysite_snomed_display,
    NULL            AS REASON_SNOMED_CODE,
    NULL            AS REASON_SNOMED_DISPLAY,
    n.NOTE_TEXT     AS NOTE_TEXT,
    n.DATA_SOURCE,
    n.LOINC_CODE    AS LOINC_CODE,
    n.LOINC_DISPLAY AS LOINC_DISPLAY,
    n.RESULT,
    n.UNITS
  FROM eeg_obs_clean n
  WHERE
    UPPER(n.NOTE_TEXT)     LIKE '%SEIZURE%'
    OR UPPER(n.NOTE_TEXT)  LIKE '%EPILEP%'
    OR UPPER(n.RESULT)     LIKE '%SEIZURE%'
    OR UPPER(n.RESULT)     LIKE '%EPILEP%'
    OR UPPER(n.LOINC_DISPLAY) LIKE '%SEIZURE%'
    OR UPPER(n.LOINC_DISPLAY) LIKE '%EPILEP%'
),

/* -------------------------
   FHIR: build Procedure and Observation evidence separately
   ------------------------- */
seizure_with_fhir_procedure AS (
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
              'system',  'http://www.ama-assn.org/go/cpt',
              'code',     s.CPT_CODE,
              'display',  NULLIF(s.CPT_DISPLAY,'')
            ),
            NULL
          ),
          IFF(s.SNOMED_CODE IS NOT NULL AND s.SNOMED_CODE <> '',
            OBJECT_CONSTRUCT(
              'system',  'http://snomed.info/sct',
              'code',     s.SNOMED_CODE,
              'display',  NULLIF(s.SNOMED_DISPLAY,'')
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
                'system', 'http://snomed.info/sct',
                'code',    s.bodysite_snomed_code,
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
                'system', 'http://snomed.info/sct',
                'code',    s.REASON_SNOMED_CODE,
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
  FROM seizure_suspects_proc s
),

seizure_with_fhir_observation AS (
  SELECT
    s.PATIENT_ID,
    s.suspect_group,
    s.suspect_icd10_code,
    s.suspect_icd10_short_description,
    s.resource_id,
    s.resource_type,
    s.DATA_SOURCE,
    OBJECT_CONSTRUCT(
      'resourceType', 'Observation',
      'id',            s.resource_id,
      'status',        COALESCE(NULLIF(s.status,''), 'final'),
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
      'valueString', IFF(s.RESULT IS NOT NULL AND s.RESULT <> '', s.RESULT, NULL),
      'effectiveDateTime', IFF(s.obs_date IS NOT NULL, TO_CHAR(s.obs_date,'YYYY-MM-DD'), NULL)
    ) AS fhir
  FROM seizure_suspects_obs s
),

seizure_with_fhir_all AS (
  SELECT * FROM seizure_with_fhir_procedure
  UNION ALL
  SELECT * FROM seizure_with_fhir_observation
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
FROM seizure_with_fhir_all
GROUP BY PATIENT_ID, suspect_group, suspect_icd10_code, suspect_icd10_short_description
ORDER BY PATIENT_ID, suspect_group;