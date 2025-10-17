{% macro get_procedcure_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select 
                id as procedure_id
            ,   code_coding_{{i}}_code as code
            ,   case 
                    when code_coding_{{i}}_system ilike '%cpt%' then 'http://www.ama-assn.org/go/cpt'
                    when code_coding_{{i}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                    else code_coding_{{i}}_system 
                end as system
            ,   code_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__procedure')}}
        where  code_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_procedcure_bodysite_codings(systems, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select *
    from (
        select 
                id as procedure_id
            ,   bodysite_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when bodysite_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                    else bodysite_{{i}}_coding_{{j}}_system 
                end as system
            ,   bodysite_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ secondary_max_index }} + 1) + {{j}} as index
        from {{ref('stage__procedure')}}
        where  bodysite_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_procedcure_reason_codings(systems, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select *
    from (
        select 
                id as procedure_id
            ,   reasoncode_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when reasoncode_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                    else reasoncode_{{i}}_coding_{{j}}_system 
                end as system
            ,   reasoncode_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ secondary_max_index }} + 1) + {{j}} as index
        from {{ref('stage__procedure')}}
        where  reasoncode_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
