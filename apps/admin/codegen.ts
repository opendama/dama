/**
 * GraphQL codegen contract for dama admin console.
 * Schema source of truth: apps/api/graphql/schema.graphql
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
