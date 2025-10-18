{% macro get_diagnostic_report_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select
                id as diagnostic_report_id
            ,   code_coding_{{i}}_code as code
            ,   case 
                    when code_coding_{{i}}_system ilike '%loinc%' then 'http://loinc.org'
                    else code_coding_{{i}}_system 
                end as system
            ,   code_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__diagnosticreport')}}
        where  code_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_diagnostic_report_category_codings(systems, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select *
    from (
        select 
                id as diagnostic_report_id
            ,   category_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when category_{{i}}_coding_{{j}}_system ilike '%v2-0074' then 'http://terminology.hl7.org/CodeSystem/v2-0074'
                end as system
            ,   category_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ secondary_max_index }} + 1) + {{j}} as index
        from {{ref('stage__diagnosticreport')}}
        where  category_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
