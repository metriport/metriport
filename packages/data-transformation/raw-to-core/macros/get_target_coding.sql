{% macro get_target_codings(
    codings_macro_name,
    codings_macro_id_field,
    codings_macro_max_index,
    codings_macro_secondary_max_index,
    target_code_systems
)%}
    with codings as (
        {% if codings_macro_secondary_max_index is not none %}
            {{ codings_macro_name(target_code_systems, codings_macro_max_index, codings_macro_secondary_max_index) }}
        {% else %}
            {{ codings_macro_name(target_code_systems, codings_macro_max_index) }}
        {% endif %}
    ),
    codings_with_rank as (
        select 
                *
            ,   row_number() over (partition by {{ codings_macro_id_field }}, system order by coding_index) as coding_rank
        from codings
    )
    select * 
    from codings_with_rank
    where coding_rank = 1
{% endmacro %}
