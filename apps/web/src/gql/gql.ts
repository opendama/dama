/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query FeatureFlags {\n  featureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n    aiDepths\n  }\n}": typeof types.FeatureFlagsDocument,
    "query Leaderboard($limit: Int) {\n  leaderboard(limit: $limit) {\n    id\n    username\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    online\n    regionalRank\n    levelLabel\n    hostTrustTier\n    hostTrustBadge\n  }\n}": typeof types.LeaderboardDocument,
    "query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    hostTrustTier\n    hostTrustBadge\n    hostFinishedPaidCups\n    hostCancelledPaidCups\n    hostOpenReports\n    recentMatches {\n      id\n      mode\n      isDraw\n      moveCount\n      isFree\n      finishedAt\n    }\n  }\n}": typeof types.MeDocument,
    "query PublisherDashboard {\n  publisherDashboard {\n    me {\n      id\n      username\n      rating\n      countryCode\n    }\n    campaigns {\n      id\n      title\n      status\n      statusLabel\n      impressions\n      clicks\n      creativeUrl\n    }\n    totalImpressions\n    totalClicks\n    totalUniqueReach\n    totalVideoCompletions\n    ctrPercent\n    cpc\n    cpcCurrency\n    completionPercent\n    createFeeSpendSum\n    createFeeSpendCurrency\n  }\n}": typeof types.PublisherDashboardDocument,
};
const documents: Documents = {
    "query FeatureFlags {\n  featureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n    aiDepths\n  }\n}": types.FeatureFlagsDocument,
    "query Leaderboard($limit: Int) {\n  leaderboard(limit: $limit) {\n    id\n    username\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    online\n    regionalRank\n    levelLabel\n    hostTrustTier\n    hostTrustBadge\n  }\n}": types.LeaderboardDocument,
    "query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    hostTrustTier\n    hostTrustBadge\n    hostFinishedPaidCups\n    hostCancelledPaidCups\n    hostOpenReports\n    recentMatches {\n      id\n      mode\n      isDraw\n      moveCount\n      isFree\n      finishedAt\n    }\n  }\n}": types.MeDocument,
    "query PublisherDashboard {\n  publisherDashboard {\n    me {\n      id\n      username\n      rating\n      countryCode\n    }\n    campaigns {\n      id\n      title\n      status\n      statusLabel\n      impressions\n      clicks\n      creativeUrl\n    }\n    totalImpressions\n    totalClicks\n    totalUniqueReach\n    totalVideoCompletions\n    ctrPercent\n    cpc\n    cpcCurrency\n    completionPercent\n    createFeeSpendSum\n    createFeeSpendCurrency\n  }\n}": types.PublisherDashboardDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query FeatureFlags {\n  featureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n    aiDepths\n  }\n}"): (typeof documents)["query FeatureFlags {\n  featureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n    aiDepths\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Leaderboard($limit: Int) {\n  leaderboard(limit: $limit) {\n    id\n    username\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    online\n    regionalRank\n    levelLabel\n    hostTrustTier\n    hostTrustBadge\n  }\n}"): (typeof documents)["query Leaderboard($limit: Int) {\n  leaderboard(limit: $limit) {\n    id\n    username\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    online\n    regionalRank\n    levelLabel\n    hostTrustTier\n    hostTrustBadge\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    hostTrustTier\n    hostTrustBadge\n    hostFinishedPaidCups\n    hostCancelledPaidCups\n    hostOpenReports\n    recentMatches {\n      id\n      mode\n      isDraw\n      moveCount\n      isFree\n      finishedAt\n    }\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n    hostTrustTier\n    hostTrustBadge\n    hostFinishedPaidCups\n    hostCancelledPaidCups\n    hostOpenReports\n    recentMatches {\n      id\n      mode\n      isDraw\n      moveCount\n      isFree\n      finishedAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query PublisherDashboard {\n  publisherDashboard {\n    me {\n      id\n      username\n      rating\n      countryCode\n    }\n    campaigns {\n      id\n      title\n      status\n      statusLabel\n      impressions\n      clicks\n      creativeUrl\n    }\n    totalImpressions\n    totalClicks\n    totalUniqueReach\n    totalVideoCompletions\n    ctrPercent\n    cpc\n    cpcCurrency\n    completionPercent\n    createFeeSpendSum\n    createFeeSpendCurrency\n  }\n}"): (typeof documents)["query PublisherDashboard {\n  publisherDashboard {\n    me {\n      id\n      username\n      rating\n      countryCode\n    }\n    campaigns {\n      id\n      title\n      status\n      statusLabel\n      impressions\n      clicks\n      creativeUrl\n    }\n    totalImpressions\n    totalClicks\n    totalUniqueReach\n    totalVideoCompletions\n    ctrPercent\n    cpc\n    cpcCurrency\n    completionPercent\n    createFeeSpendSum\n    createFeeSpendCurrency\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;