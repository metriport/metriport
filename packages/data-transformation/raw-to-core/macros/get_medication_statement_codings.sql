-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_statement_category_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select
                id as medication_statement_id
            ,   category_coding_{{i}}_code as code
            ,   case 
                    when category_coding_{{i}}_system ilike '%medication-statement-category' then 'http://terminology.hl7.org/CodeSystem/medication-statement-category'
                end as system
            ,   category_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__medicationstatement')}}
        where  category_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
