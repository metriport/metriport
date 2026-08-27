{#

    This macro generates a deterministic UUID using adapter-specific functions.
    If base is not provided or is None, it generates a random UUID as base.
    The salt parameter is required and is used to ensure determinism when base is provided.

    Usage:
    - generate_uuid(base=None, salt='value') - generates a random UUID as base
    - generate_uuid(base='value', salt='value') - uses provided base value

#}

{%- macro generate_uuid(base, salt) -%}

    {{ return(adapter.dispatch('generate_uuid')(base, salt)) }}

{%- endmacro -%}

{%- macro default__generate_uuid(base, salt) -%}
    {%- if base is none -%}
        gen_random_uuid()
    {%- else -%}
        (
            select format(
                '%s-%s-%s-%s-%s',
                substr(md5_hash, 1, 8),
                substr(md5_hash, 9, 4),
                substr(md5_hash, 13, 4),
                substr(md5_hash, 17, 4),
                substr(md5_hash, 21, 12)
            )::uuid
            from (select md5(concat(cast({{ base }} as text), cast({{ salt }} as text))) as md5_hash) as t
        )
    {%- endif -%}
{%- endmacro -%}

{%- macro postgres__generate_uuid(base, salt) -%}
    {%- if base is none -%}
        gen_random_uuid()
    {%- else -%}
        (
            select format(
                '%s-%s-%s-%s-%s',
                substr(md5_hash, 1, 8),
                substr(md5_hash, 9, 4),
                substr(md5_hash, 13, 4),
                substr(md5_hash, 17, 4),
                substr(md5_hash, 21, 12)
            )::uuid
            from (select md5(concat(cast({{ base }} as text), cast({{ salt }} as text))) as md5_hash) as t
        )
    {%- endif -%}
{%- endmacro -%}

{%- macro snowflake__generate_uuid(base, salt) -%}
    {%- if base is none -%}
        uuid_string(uuid_string(), cast({{ salt }} as varchar))
    {%- else -%}
        uuid_string({{ base }}, cast({{ salt }} as varchar))
    {%- endif -%}
{%- endmacro -%}
