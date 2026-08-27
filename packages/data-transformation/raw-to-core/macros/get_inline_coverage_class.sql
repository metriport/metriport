{% macro get_coverage_class(table_name, class_type_code, max_index) %}
    {#- Optimized: Single table scan using cross join lateral unnest -#}
    with base_table as (
        select 
            id
            {% for i in range(max_index + 1) %},
            class_{{i}}_value,
            class_{{i}}_name,
            class_{{i}}_type_coding_0_code,
            class_{{i}}_type_coding_0_display,
            class_{{i}}_type_coding_0_system,
            class_{{i}}_type_coding_1_code,
            class_{{i}}_type_coding_1_display,
            class_{{i}}_type_coding_1_system
            {% endfor %}
        from {{ref(table_name)}}
    )
    select 
        coverage_id,
        class_value,
        class_name,
        class_type_code,
        class_type_display,
        class_type_system
    from (
        select 
            *,
            row_number() over (partition by coverage_id order by class_index) as rn
        from (
            select 
                b.id as coverage_id,
                t.class_value,
                t.class_name,
                coalesce(
                    case when lower(t.class_type_coding_0_code) = lower('{{class_type_code}}') 
                         then t.class_type_coding_0_code end,
                    case when lower(t.class_type_coding_1_code) = lower('{{class_type_code}}') 
                         then t.class_type_coding_1_code end
                ) as class_type_code,
                coalesce(
                    case when lower(t.class_type_coding_0_code) = lower('{{class_type_code}}') 
                         then t.class_type_coding_0_display end,
                    case when lower(t.class_type_coding_1_code) = lower('{{class_type_code}}') 
                         then t.class_type_coding_1_display end
                ) as class_type_display,
                coalesce(
                    case when lower(t.class_type_coding_0_code) = lower('{{class_type_code}}') 
                         then t.class_type_coding_0_system end,
                    case when lower(t.class_type_coding_1_code) = lower('{{class_type_code}}') 
                         then t.class_type_coding_1_system end
                ) as class_type_system,
                t.class_index_1based - 1 as class_index
            from base_table b
            cross join lateral unnest(
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_value{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_name{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_type_coding_0_code{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_type_coding_0_display{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_type_coding_0_system{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_type_coding_1_code{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_type_coding_1_display{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ],
                array[
                    {% for i in range(max_index + 1) %}
                    b.class_{{i}}_type_coding_1_system{% if not loop.last %}, {% endif %}
                    {% endfor %}
                ]
            ) with ordinality as t(class_value, class_name, class_type_coding_0_code, class_type_coding_0_display, class_type_coding_0_system, class_type_coding_1_code, class_type_coding_1_display, class_type_coding_1_system, class_index_1based)
            where (
                lower(t.class_type_coding_0_code) = lower('{{class_type_code}}')
                or lower(t.class_type_coding_1_code) = lower('{{class_type_code}}')
            )
            and (t.class_value is not null or t.class_name is not null)
        ) as all_matches
    ) as ranked
    where rn = 1
{% endmacro %}
