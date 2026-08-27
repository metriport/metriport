{% macro map_encounter_discharge_disposition_code(source_code, source_display) %}
{#
  Maps source discharge disposition values to HL7 discharge-disposition codes.
  Uses pattern matching on code and display values.
  Reference: http://terminology.hl7.org/CodeSystem/discharge-disposition
  Order matters for precedence - must match TypeScript implementation.
  Note: Using .* wildcards for POSIX ERE compatibility.
  Cross-database: Snowflake uses REGEXP/RLIKE, PostgreSQL uses ~*
#}
case
    -- 1. Hospice (check before "home" patterns since "Home - Hospice" / "Hospice - home" contain "home")
    when {{ regex_match(source_code, '.*hospice.*|.*palliative.*') }}
      or {{ regex_match(source_display, '.*hospice.*|.*palliative.*') }}
    then 'hosp'

    -- 2. Against Medical Advice / Left without being seen (check early - "Left" could match other things)
    when {{ regex_match(source_code, '.*against.*medical.*advice.*|.*left.*(against|without|ama|w/o).*|.*(ama|lwbs|lwt|lwcs).*|.*eloped?.*|.*discontinued?.*care.*|.*walk[- ]?away.*') }}
      or {{ regex_match(source_display, '.*against.*medical.*advice.*|.*left.*(against|without|ama|w/o).*|.*(ama|lwbs|lwt|lwcs).*|.*eloped?.*|.*discontinued?.*care.*|.*walk[- ]?away.*') }}
    then 'aadvice'

    -- 3. Deceased / Expired
    when {{ regex_match(source_code, '.*expire[ds]?.*|.*deceased.*|.*death.*|.*died.*') }}
      or {{ regex_match(source_display, '.*expire[ds]?.*|.*deceased.*|.*death.*|.*died.*') }}
    then 'exp'

    -- 4. Psychiatric (check before general hospital patterns)
    when {{ regex_match(source_code, '.*psych(iatric)?.*|.*mental.*health.*|.*behavioral.*health.*') }}
      or {{ regex_match(source_display, '.*psych(iatric)?.*|.*mental.*health.*|.*behavioral.*health.*') }}
    then 'psy'

    -- 5. Rehabilitation (check before general facility patterns)
    when {{ regex_match(source_code, '.*rehab(ilitation)?.*|.*irf.*') }}
      or {{ regex_match(source_display, '.*rehab(ilitation)?.*|.*irf.*') }}
    then 'rehab'

    -- 6. Skilled Nursing Facility
    when {{ regex_match(source_code, '.*snf.*|.*skilled.*nursing.*|.*sar.*') }}
      or {{ regex_match(source_display, '.*snf.*|.*skilled.*nursing.*|.*sar.*') }}
    then 'snf'

    -- 7. Long-term care (LTAC, Intermediate Care, Assisted Living, Custodial, Swing Bed, Nursing Home)
    when {{ regex_match(source_code, '.*lt(a)?c.*|.*long[- ]?term.*|.*intermediate.*care.*|.*assisted.*living.*|.*custodial.*|.*swing.*bed.*|.*nursing.*(home|facility).*|.*icf.*') }}
      or {{ regex_match(source_display, '.*lt(a)?c.*|.*long[- ]?term.*|.*intermediate.*care.*|.*assisted.*living.*|.*custodial.*|.*swing.*bed.*|.*nursing.*(home|facility).*|.*icf.*') }}
    then 'long'

    -- 8. Other healthcare facility (hospitals, acute care, transfers)
    when {{ regex_match(source_code, '.*hospital.*|.*acute.*care.*|.*short[- ]?term.*|.*trans(fer|d).*|.*critical.*access.*|.*federal.*(hosp|health).*|.*cancer.*center.*|.*children.?s.*hospital.*|.*inpatient.*to.*this.*|.*admitted.*(as.*)?(an.*)?inpatient.*|.*pps.*') }}
      or {{ regex_match(source_display, '.*hospital.*|.*acute.*care.*|.*short[- ]?term.*|.*trans(fer|d).*|.*critical.*access.*|.*federal.*(hosp|health).*|.*cancer.*center.*|.*children.?s.*hospital.*|.*inpatient.*to.*this.*|.*admitted.*(as.*)?(an.*)?inpatient.*|.*pps.*') }}
    then 'other-hcf'

    -- 9. Alt-home: Home with services (home health, DME, IV therapy, etc.)
    when {{ regex_match(source_code, '.*home[- ]?health.*|.*home.*with.*(home.*)?health.*|.*home.*w/.*|.*dme.*|.*iv.*(therapy|provider).*|.*organized.*home.*|.*under.*care.*of.*|.*care.*(of|by).*.*health.*|.*pt/ot.*|.*mgmc.*home.*') }}
      or {{ regex_match(source_display, '.*home[- ]?health.*|.*home.*with.*(home.*)?health.*|.*home.*w/.*|.*dme.*|.*iv.*(therapy|provider).*|.*organized.*home.*|.*under.*care.*of.*|.*care.*(of|by).*.*health.*|.*pt/ot.*|.*mgmc.*home.*') }}
    then 'alt-home'

    -- 10. Plain home (self care, routine discharge)
    when {{ regex_match(source_code, '.*home.*|.*self[- ]?care.*|.*routine.*(discharge)?.*|.*residence.*|.*foster.*care.*|.*group.*home.*') }}
      or {{ regex_match(source_display, '.*home.*|.*self[- ]?care.*|.*routine.*(discharge)?.*|.*residence.*|.*foster.*care.*|.*group.*home.*') }}
    then 'home'

    -- 11. Other (Court/law enforcement, unknown, errors, still patient, etc.)
    when {{ regex_match(source_code, '.*court.*|.*law.*enforcement.*|.*jail.*|.*prison.*|.*unknown.*|.*error.*|.*voided.*|.*canceled.*|.*still.*(a.*)?(patient|inhouse).*|.*never.*arrived.*|.*diverted.*|.*alternate.*care.*site.*|.*disaster.*') }}
      or {{ regex_match(source_display, '.*court.*|.*law.*enforcement.*|.*jail.*|.*prison.*|.*unknown.*|.*error.*|.*voided.*|.*canceled.*|.*still.*(a.*)?(patient|inhouse).*|.*never.*arrived.*|.*diverted.*|.*alternate.*care.*site.*|.*disaster.*') }}
    then 'oth'

    else null
end
{% endmacro %}


{% macro map_encounter_discharge_disposition_display(mapped_code) %}
{#
  Returns the HL7 display value for a mapped discharge disposition code.
#}
case {{ mapped_code }}
    when 'home' then 'Home'
    when 'alt-home' then 'Alternative home'
    when 'other-hcf' then 'Other healthcare facility'
    when 'hosp' then 'Hospice'
    when 'long' then 'Long-term care'
    when 'aadvice' then 'Left against advice'
    when 'exp' then 'Expired'
    when 'psy' then 'Psychiatric hospital'
    when 'rehab' then 'Rehabilitation'
    when 'snf' then 'Skilled nursing facility'
    when 'oth' then 'Other'
    else null
end
{% endmacro %}


{% macro regex_match(column, pattern) %}
{#
  Cross-database regex matching (case-insensitive).
  - Snowflake: uses RLIKE/REGEXP with lower()
  - PostgreSQL: uses ~* operator (case-insensitive)
#}
{% if target.name == 'postgres' %}
    {{ column }} ~* '{{ pattern }}'
{% else %}
    lower({{ column }}) regexp '{{ pattern }}'
{% endif %}
{% endmacro %}
