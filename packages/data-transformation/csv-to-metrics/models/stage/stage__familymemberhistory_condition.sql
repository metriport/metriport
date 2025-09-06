
-- SELECT statement for FamilyMemberHistory_condition
SELECT 
    code_coding_0_system,
    code_coding_0_code,
    code_text,
    code_coding_0_display,
    onsetage_value,
    onsetage_unit,
    onsetage_system,
    onsetage_code,
    code_coding_1_code,
    code_coding_1_display,
    code_coding_1_system,
    code_coding_2_code,
    code_coding_2_display,
    code_coding_2_system,
    code_coding_3_code,
    code_coding_3_display,
    code_coding_3_system,
    filename,
    processed_date 
FROM {{source('raw', 'familymemberhistory_condition') }} x

QUALIFY rank() over(partition by filename order by processed_date desc) = 1