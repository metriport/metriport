{% macro medication_administration_category_code_system() %}
    case 
        when system = 'medication-category' then 0
        when system = 'snomed-ct' then 1
        else 2
    end
{% endmacro %}

{% macro get_medication_administration_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_administration_id
        ,   category_coding_{{i}}_code as code
        ,   case 
                when category_coding_{{i}}_system = 'http://terminology.hl7.org/CodeSystem/medication-category' then 'medication-category'
                when category_coding_{{i}}_system ilike '%snomed%' then 'snomed-ct'
                else category_coding_{{i}}_system 
            end as system
        ,   category_coding_{{i}}_display as display
        ,   coalesce(
                category_coding_{{i}}_display,
                category_text
            ) as description
    from {{ref(stage_table)}}
    where  category_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro medication_administration_reason_code_system() %}
    case 
        when system = 'snomed-ct' then 0
        when system = 'icd-10-cm' then 1
        when system = 'loinc' then 2
        else 3
    end
{% endmacro %}

{% macro get_medication_administration_reason_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as medication_administration_id
        ,   reasoncode_{{i}}_coding_{{j}}_code as code
        ,   case 
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'snomed-ct'
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%icd-10%' then 'icd-10-cm'
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%loinc%' then 'loinc'
                else reasoncode_{{i}}_coding_{{j}}_system 
            end as system
        ,   reasoncode_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                reasoncode_{{i}}_coding_{{j}}_display,
                reasoncode_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  reasoncode_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}