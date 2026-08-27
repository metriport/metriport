{% macro get_allergy_intolerance_reaction_substance_codings(systems, max_reaction_index, max_coding_index) %}
    {#- Optimized: Single table scan with CTE -#}
    with base_allergy as (
        select 
            id
            {% for i in range(max_reaction_index + 1) %}
            {% for j in range(max_coding_index + 1) %},
            reaction_{{i}}_substance_coding_{{j}}_code,
            reaction_{{i}}_substance_coding_{{j}}_system,
            reaction_{{i}}_substance_coding_{{j}}_display
            {% endfor %}
            {% endfor %}
        from {{ref('stage__allergyintolerance')}}
    )
    {% for i in range(max_reaction_index + 1) %}
    {% for j in range(max_coding_index + 1) %}
    select 
        id as allergy_intolerance_id,
        {{i}} as reaction_index,
        reaction_{{i}}_substance_coding_{{j}}_code as code,
        case 
            when reaction_{{i}}_substance_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
            else reaction_{{i}}_substance_coding_{{j}}_system 
        end as system,
        reaction_{{i}}_substance_coding_{{j}}_display as display,
        {{i}} * ({{ max_coding_index }} + 1) + {{j}} as coding_index
    from base_allergy
    where reaction_{{i}}_substance_coding_{{j}}_code != '' 
        and reaction_{{i}}_substance_coding_{{j}}_code is not null
        and case 
            when reaction_{{i}}_substance_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
            else reaction_{{i}}_substance_coding_{{j}}_system 
        end in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_allergy_intolerance_reaction_manifestation_codings(systems, max_reaction_index, max_manifestation_index, max_coding_index) %}
    {#- Optimized: Single table scan with CTE -#}
    with base_allergy as (
        select 
            id
            {% for i in range(max_reaction_index + 1) %}
            {% for k in range(max_manifestation_index + 1) %}
            {% for j in range(max_coding_index + 1) %},
            reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_code,
            reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_system,
            reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_display
            {% endfor %}
            {% endfor %}
            {% endfor %}
        from {{ref('stage__allergyintolerance')}}
    )
    {% for i in range(max_reaction_index + 1) %}
    {% for k in range(max_manifestation_index + 1) %}
    {% for j in range(max_coding_index + 1) %}
    select 
        id as allergy_intolerance_id,
        {{i}} as reaction_index,
        {{k}} as manifestation_index,
        reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_code as code,
        case 
            when reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
            else reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_system 
        end as system,
        reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_display as display,
        {{i}} * ({{ max_manifestation_index }} + 1) * ({{ max_coding_index }} + 1) + {{k}} * ({{ max_coding_index }} + 1) + {{j}} as coding_index
    from base_allergy
    where reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_code != '' 
        and reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_code is not null
        and case 
            when reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
            else reaction_{{i}}_manifestation_{{k}}_coding_{{j}}_system 
        end in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
