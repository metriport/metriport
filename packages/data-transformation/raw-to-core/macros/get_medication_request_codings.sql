-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_request_category_codings(systems, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select *
    from (
        select
                id as medication_request_id
            ,   category_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when category_{{i}}_coding_{{j}}_system ilike '%medicationrequest-category' then 'http://terminology.hl7.org/CodeSystem/medicationrequest-category'
                    else category_{{i}}_coding_{{j}}_system 
                end as system
            ,   category_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ secondary_max_index }} + 1) + {{j}} as index
        from {{ref('stage__medicationrequest')}}
        where  category_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
