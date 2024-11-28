import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const functionName = "immutable_replace";

/**
 * Needed because replace() is not immutable and Postgres requires all functions on a generated
 * column to be immutable.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  const query = `
CREATE OR REPLACE FUNCTION ${functionName}(
    input_string text,
    from_text text,
    to_text text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
    SELECT replace(input_string, from_text, to_text);
$$;
`;
  await queryInterface.sequelize.query(query, { type: QueryTypes.RAW });
};

export const down: Migration = async ({ context: queryInterface }) => {
  const query = `DROP FUNCTION ${functionName};`;
  await queryInterface.sequelize.query(query, { type: QueryTypes.RAW });
};
