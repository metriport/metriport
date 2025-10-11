{% macro condition_code_system() %}
    case 
        when system = 'icd-10-cm' then 0
        when system = 'snomed-ct' then 1
        when system = 'icd-9-cm' then 2
        when system = 'loinc' then 3
        else 4 
    end
{% endmacro %}

{% macro get_condition_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as condition_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%icd-10%' then 'icd-10-cm'
                when code_coding_{{i}}_system ilike '%snomed%' then 'snomed-ct'
                when code_coding_{{i}}_system ilike '%icd-9%' then 'icd-9-cm'
                when code_coding_{{i}}_system ilike '%loinc%' then 'loinc'
                else code_coding_{{i}}_system 
            end as system
        ,   code_coding_{{i}}_display as display
        ,   coalesce(
                code_coding_{{i}}_display,
                code_text
            ) as description
    from {{ref(stage_table)}}
    where  code_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro condition_category_code_system() %}
    case 
        when system = 'loinc' then 0
        when system = 'snomed-ct' then 1
        else 2
    end
{% endmacro %}

{% macro get_condition_category_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as condition_id
        ,   category_{{i}}_coding_{{j}}_code as code
        ,   case 
                when category_{{i}}_coding_{{j}}_system ilike '%loinc%' then 'loinc'
                when category_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'snomed-ct'
                else category_{{i}}_coding_{{j}}_system 
            end as system
        ,   category_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                category_{{i}}_coding_{{j}}_display,
                category_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  category_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro condition_clinical_status_code_system() %}
    case 
        when system = 'snomed-ct' then 0
        else 1
    end
{% endmacro %}

{% macro get_condition_clinical_status_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as condition_id
        ,   clinicalstatus_coding_{{i}}_code as code
        ,   case 
                when clinicalstatus_coding_{{i}}_system ilike '%snomed%' then 'snomed-ct'
                else clinicalstatus_coding_{{i}}_system 
            end as system
        ,   clinicalstatus_coding_{{i}}_display as display
        ,   clinicalstatus_coding_{{i}}_display as description
    from {{ref(stage_table)}}
    where  clinicalstatus_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro condition_bodysite_code_system() %}
    case 
        when system = 'snomed-ct' then 0
        when system = 'icd-10-cm' then 1
        when system = 'loinc' then 2
        else 3
    end
{% endmacro %}

{% macro get_condition_bodysite_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as condition_id
        ,   bodysite_{{i}}_coding_{{j}}_code as code
        ,   case 
                when bodysite_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'snomed-ct'
                when bodysite_{{i}}_coding_{{j}}_system ilike '%icd-10%' then 'icd-10-cm'
                when bodysite_{{i}}_coding_{{j}}_system ilike '%loinc%' then 'loinc'
                else bodysite_{{i}}_coding_{{j}}_system 
            end as system
        ,   bodysite_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                bodysite_{{i}}_coding_{{j}}_display,
                bodysite_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  bodysite_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}