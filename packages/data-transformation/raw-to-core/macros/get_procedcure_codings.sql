{% macro get_procedcure_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as procedure_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system = 'http://www.ama-assn.org/go/cpt' then 'cpt'
                when code_coding_{{i}}_system = 'http://loinc.org' then 'loinc'
                when code_coding_{{i}}_system = 'http://snomed.info/sct' then 'snomed-ct'
                when code_coding_{{i}}_system = 'http://www.ada.org/cdt' then 'cdt'
                when code_coding_{{i}}_system = 'urn:oid:2.16.840.1.113883.6.285' then 'hcpcs'
                when code_coding_{{i}}_system like '%1.2.840.114350.1%' then 'epic'
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

{% macro get_procedcure_bodysite_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as procedure_id
        ,   bodysite_{{i}}_coding_{{j}}_code as code
        ,   case 
                when bodysite_{{i}}_coding_{{j}}_system = 'http://www.ama-assn.org/go/cpt' then 'cpt'
                when bodysite_{{i}}_coding_{{j}}_system = 'http://loinc.org' then 'loinc'
                when bodysite_{{i}}_coding_{{j}}_system = 'http://snomed.info/sct' then 'snomed-ct'
                when bodysite_{{i}}_coding_{{j}}_system = 'http://www.ada.org/cdt' then 'cdt'
                when bodysite_{{i}}_coding_{{j}}_system = 'urn:oid:2.16.840.1.113883.6.285' then 'hcpcs'
                when bodysite_{{i}}_coding_{{j}}_system like '%1.2.840.114350.1%' then 'epic'
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

{% macro get_procedcure_reason_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as procedure_id
        ,   reasoncode_{{i}}_coding_{{j}}_code as code
        ,   case 
                when reasoncode_{{i}}_coding_{{j}}_system = 'http://www.ama-assn.org/go/cpt' then 'cpt'
                when reasoncode_{{i}}_coding_{{j}}_system = 'http://loinc.org' then 'loinc'
                when reasoncode_{{i}}_coding_{{j}}_system = 'http://snomed.info/sct' then 'snomed-ct'
                when reasoncode_{{i}}_coding_{{j}}_system = 'http://www.ada.org/cdt' then 'cdt'
                when reasoncode_{{i}}_coding_{{j}}_system = 'urn:oid:2.16.840.1.113883.6.285' then 'hcpcs'
                when reasoncode_{{i}}_coding_{{j}}_system like '%1.2.840.114350.1%' then 'epic'
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