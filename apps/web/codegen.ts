/**
 * GraphQL codegen contract for dama web.
 * Schema source of truth: apps/api/graphql/schema.graphql
 *
 * Install once:
 *   pnpm --filter @dama/web add -D @graphql-codegen/cli @graphql-codegen/client-preset
 * Then:
 *   pnpm --filter @dama/web codegen
 */
const config = {
  schema: "../api/graphql/schema.graphql",
  documents: ["src/graphql/**/*.graphql"],
  generates: {
    "src/gql/": {
      preset: "client",
      plugins: [],
    },
  },
  ignoreNoDocuments: true,
};

export default config;
