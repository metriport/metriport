{% macro get_target_coding(
    codings_macro_name, 
    codings_macro_stage_table, 
    codings_macro_id_field,
    codings_macro_max_index, 
    codings_macro_secondary_max_index,
    ranked_code_system_macro_name
)%}
    with codings as (
        {% if codings_macro_secondary_max_index is not none %}
            {{ codings_macro_name(codings_macro_stage_table, codings_macro_max_index, codings_macro_secondary_max_index) }}
        {% else %}
            {{ codings_macro_name(codings_macro_stage_table, codings_macro_max_index) }}
        {% endif %}
    ),
    codings_with_static_rank as (
        select 
                {{ codings_macro_id_field }}
            ,   code
            ,   system
            ,   display
            ,   {{ ranked_code_system_macro_name() }} as static_rank
        from codings
    ),
    codings_with_relative_rank as (
        select
                {{ codings_macro_id_field }}
            ,   code
            ,   system
            ,   display
            ,   row_number() over(partition by {{ codings_macro_id_field }} order by static_rank) as relative_rank
        from codings_with_static_rank
    )
    select *
    from codings_with_relative_rank
    where relative_rank = 1
{% endmacro %}