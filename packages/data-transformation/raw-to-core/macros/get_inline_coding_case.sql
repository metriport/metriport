{% macro get_inline_coding_case(
    base_alias,
    coding_prefix,
    target_system,
    max_index,
    field_type
) %}
    {#-
    Generates an inline COALESCE with CASE statements that checks each coding index directly.
    Returns the first matching code/display for the target system.
    
    Args:
        base_alias: Alias of the base table (e.g., 'c')
        coding_prefix: Prefix for coding columns (e.g., 'code_coding', 'category_0_coding')
        target_system: The target system URL to match
        max_index: Maximum coding index to check (0-based, so max_index=10 checks 0-10)
        field_type: 'code' or 'display'
    -#}
    {#- Optimized: COALESCE short-circuits, but we nest to ensure early exit -#}
    {% if max_index == 0 %}
        {#- Single index: no need for COALESCE -#}
        case 
            when (
                {#- Main systems -#}
                {% if target_system == 'http://hl7.org/fhir/sid/icd-10-cm' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%icd-10%'
                {% elif target_system == 'http://snomed.info/sct' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%snomed%'
                {% elif target_system == 'http://hl7.org/fhir/sid/icd-9-cm' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%icd-9%'
                {% elif target_system == 'https://hcup-us.ahrq.gov/toolssoftware/ccsr/ccs_refined.jsp' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%ccsr%'
                {% elif target_system == 'http://loinc.org' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%loinc%'
                {% elif target_system == 'http://www.ama-assn.org/go/cpt' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%cpt%'
                {% elif target_system == 'http://www.nlm.nih.gov/research/umls/rxnorm' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%rxnorm%'
                {% elif target_system == 'http://hl7.org/fhir/sid/ndc' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%ndc%'
                {% elif target_system == 'http://hl7.org/fhir/sid/cvx' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%cvx%'
                {#- HL7 Code Systems -#}
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%allergyintolerance-clinical'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/condition-clinical' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%condition-clinical'
                {% elif target_system == 'http://terminology.hl7.org/CodeSystem/discharge-disposition' %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system ilike '%discharge-disposition'
                {% else %}
                    {{ base_alias }}.{{ coding_prefix }}_0_system = '{{ target_system }}'
                {% endif %}
            )
            and {{ base_alias }}.{{ coding_prefix }}_0_code is not null
            and {{ base_alias }}.{{ coding_prefix }}_0_code != ''
            then {{ base_alias }}.{{ coding_prefix }}_0_{{ field_type }}
        end
    {% else %}
        {#- Multiple indices: use nested COALESCE for early exit -#}
        coalesce(
            {% for i in range(max_index + 1) %}
            case 
                when (
                    {#- Main systems -#}
                    {% if target_system == 'http://hl7.org/fhir/sid/icd-10-cm' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%icd-10%'
                    {% elif target_system == 'http://snomed.info/sct' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%snomed%'
                    {% elif target_system == 'http://hl7.org/fhir/sid/icd-9-cm' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%icd-9%'
                    {% elif target_system == 'https://hcup-us.ahrq.gov/toolssoftware/ccsr/ccs_refined.jsp' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%ccsr%'
                    {% elif target_system == 'http://loinc.org' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%loinc%'
                    {% elif target_system == 'http://www.ama-assn.org/go/cpt' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%cpt%'
                    {% elif target_system == 'http://www.nlm.nih.gov/research/umls/rxnorm' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%rxnorm%'
                    {% elif target_system == 'http://hl7.org/fhir/sid/ndc' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%ndc%'
                    {% elif target_system == 'http://hl7.org/fhir/sid/cvx' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%cvx%'
                    {#- HL7 Code Systems -#}
                    {% elif target_system == 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%allergyintolerance-clinical'
                    {% elif target_system == 'http://terminology.hl7.org/CodeSystem/condition-clinical' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%condition-clinical'
                    {% elif target_system == 'http://terminology.hl7.org/CodeSystem/discharge-disposition' %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system ilike '%discharge-disposition'
                    {% else %}
                        {{ base_alias }}.{{ coding_prefix }}_{{ i }}_system = '{{ target_system }}'
                    {% endif %}
                )
                and {{ base_alias }}.{{ coding_prefix }}_{{ i }}_code is not null
                and {{ base_alias }}.{{ coding_prefix }}_{{ i }}_code != ''
                then {{ base_alias }}.{{ coding_prefix }}_{{ i }}_{{ field_type }}
            end{% if not loop.last %},{% endif %}
            {% endfor %}
        )
    {% endif %}
{% endmacro %}
