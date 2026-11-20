import { apiGraphqlUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useAuthStore } from "@/store/auth";
import type { GraphQLResponse } from "@/types/graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { type DocumentNode, print } from "graphql";

type GraphQLDocument<TResult, TVariables> =
  | string
  | DocumentNode
  | TypedDocumentNode<TResult, TVariables>;

/** GraphQL transport only. Domain operations live in hooks/query and hooks/mutation. */
export async function graphqlRequest<TResult, TVariables = Record<string, unknown>>(
  document: GraphQLDocument<TResult, TVariables>,
  variables?: TVariables,
  token?: string | null,
  emptyMessage?: string,
): Promise<TResult> {
  // TypedDocumentNode uses kind: "Document"; graphql print() expects Kind.DOCUMENT.
  const query = typeof document === "string" ? document : print(document as DocumentNode);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(apiGraphqlUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    credentials: "include",
  });
  if (res.status === 401 && token) {
    clearSessionAndBounceToLogin();
    throw new Error("unauthorized");
  }
  const json = (await res.json()) as GraphQLResponse<TResult>;
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    if (token && /unauthorized|unauthenticated/i.test(msg)) {
      clearSessionAndBounceToLogin();
    }
    throw new Error(msg);
  }
  if (!json.data) {
    throw new Error((emptyMessage || "").trim());
  }
  return json.data;
}
