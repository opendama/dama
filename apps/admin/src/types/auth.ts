import type { MeQuery } from "@/gql/graphql";

/** Session user shape (OAuth exchange + GraphQL `me`). */
export type MeProfile = NonNullable<MeQuery["me"]>;
export type AuthUser = MeProfile;
