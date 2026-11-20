/** Shared GraphQL transport envelope (not domain payload shapes). */
export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};
