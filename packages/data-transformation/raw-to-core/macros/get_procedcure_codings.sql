{% macro procedure_code_system() %}
    case 
        when system = 'cpt' then 0
        when system = 'loinc' then 1
        when system = 'snomed-ct' then 2
        when system = 'hcpcs' then 3
        else 4
    end
{% endmacro %}

{% macro get_procedcure_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as procedure_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%cpt%' then 'cpt'
                when code_coding_{{i}}_system ilike '%loinc%' then 'loinc'
                when code_coding_{{i}}_system ilike '%snomed%' then 'snomed-ct'
                when code_coding_{{i}}_system ilike '%hcpcs%' then 'hcpcs'
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

{% macro procedure_bodysite_code_system() %}
    case 
        when system = 'cpt' then 0
        when system = 'loinc' then 1
        when system = 'snomed-ct' then 2
        when system = 'hcpcs' then 3
        else 4
    end
{% endmacro %}

{% macro get_procedcure_bodysite_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as procedure_id
        ,   bodysite_{{i}}_coding_{{j}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%cpt%' then 'cpt'
                when code_coding_{{i}}_system ilike '%loinc%' then 'loinc'
                when code_coding_{{i}}_system ilike '%snomed%' then 'snomed-ct'
                when code_coding_{{i}}_system ilike '%hcpcs%' then 'hcpcs'
                else bodysite_{{i}}_coding_{{j}}_system 
            end as system
        ,   bodysite_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                bodysite_{{i}}_coding_{{j}}_display,
                code_text
            ) as description
    from {{ref(stage_table)}}
    where  bodysite_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro procedure_reason_code_system() %}
    case 
        when system = 'cpt' then 0
        when system = 'loinc' then 1
        when system = 'snomed-ct' then 2
        when system = 'hcpcs' then 3
        else 4
    end
{% endmacro %}

{% macro get_procedcure_reason_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as procedure_id
        ,   reasoncode_{{i}}_coding_{{j}}_code as code
        ,   case 
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%cpt%' then 'cpt'
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%loinc%' then 'loinc'
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'snomed-ct'
                when reasoncode_{{i}}_coding_{{j}}_system ilike '%hcpcs%' then 'hcpcs'
                else reasoncode_{{i}}_coding_{{j}}_system 
            end as system
        ,   reasoncode_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                reasoncode_{{i}}_coding_{{j}}_display,
                code_text
            ) as description
    from {{ref(stage_table)}}
    where  reasoncode_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}