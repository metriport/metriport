
-- SELECT statement for FamilyMemberHistory
SELECT 
    resourcetype,
    id,
    meta_versionid,
    meta_lastupdated,
    meta_source,
    identifier_0_system,
    identifier_0_value,
    status,
    patient_reference,
    relationship_coding_0_system,
    relationship_coding_0_code,
    relationship_coding_0_display,
    relationship_text,
    sex_coding_0_system,
    sex_coding_0_code,
    sex_coding_0_display,
    identifier_1_system,
    identifier_1_value,
    identifier_2_system,
    identifier_2_value,
    relationship_coding_1_code,
    relationship_coding_1_display,
    relationship_coding_1_system,
    identifier_3_system,
    identifier_3_value,
    identifier_4_system,
    identifier_4_value,
    identifier_5_system,
    identifier_5_value,
    filename,
    processed_date 
FROM {{source('raw', 'familymemberhistory') }} x

QUALIFY rank() over(partition by filename order by processed_date desc) = 1