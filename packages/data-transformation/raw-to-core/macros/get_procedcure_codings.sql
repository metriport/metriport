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