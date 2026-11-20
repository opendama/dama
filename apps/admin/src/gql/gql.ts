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
    "query ConsoleFeatureFlags {\n  consoleFeatureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}": typeof types.ConsoleFeatureFlagsDocument,
    "mutation CreateTournament($title: String!, $description: String, $isFree: Boolean, $entryFeeAmount: Float, $entryFeeCurrency: String, $prizePoolAmount: Float, $prizePoolCurrency: String, $prizePoolDisplayEnabled: Boolean, $maxPlayers: Int, $formatId: String, $arenaDurationMinutes: Int, $prizePayoutMode: String, $prizePlacePercents: String) {\n  createTournament(\n    title: $title\n    description: $description\n    isFree: $isFree\n    entryFeeAmount: $entryFeeAmount\n    entryFeeCurrency: $entryFeeCurrency\n    prizePoolAmount: $prizePoolAmount\n    prizePoolCurrency: $prizePoolCurrency\n    prizePoolDisplayEnabled: $prizePoolDisplayEnabled\n    maxPlayers: $maxPlayers\n    formatId: $formatId\n    arenaDurationMinutes: $arenaDurationMinutes\n    prizePayoutMode: $prizePayoutMode\n    prizePlacePercents: $prizePlacePercents\n  ) {\n    id\n    title\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n    formatId\n    arenaDurationMinutes\n    prizePayoutMode\n    prizePlacePercents\n  }\n}": typeof types.CreateTournamentDocument,
    "query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n  }\n}": typeof types.MeDocument,
    "mutation SetFeatureFlag($key: String!, $enabled: Boolean!, $mode: String, $depths: [Int!], $disabledCountries: [String!]) {\n  setFeatureFlag(\n    key: $key\n    enabled: $enabled\n    mode: $mode\n    depths: $depths\n    disabledCountries: $disabledCountries\n  ) {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}": typeof types.SetFeatureFlagDocument,
    "mutation SetTournamentStatus($id: ID!, $status: String!) {\n  setTournamentStatus(id: $id, status: $status) {\n    id\n    status\n  }\n}": typeof types.SetTournamentStatusDocument,
    "query Tournaments {\n  tournaments {\n    id\n    title\n    description\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    prizeImageUrl\n    gallery\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n  }\n}": typeof types.TournamentsDocument,
};
const documents: Documents = {
    "query ConsoleFeatureFlags {\n  consoleFeatureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}": types.ConsoleFeatureFlagsDocument,
    "mutation CreateTournament($title: String!, $description: String, $isFree: Boolean, $entryFeeAmount: Float, $entryFeeCurrency: String, $prizePoolAmount: Float, $prizePoolCurrency: String, $prizePoolDisplayEnabled: Boolean, $maxPlayers: Int, $formatId: String, $arenaDurationMinutes: Int, $prizePayoutMode: String, $prizePlacePercents: String) {\n  createTournament(\n    title: $title\n    description: $description\n    isFree: $isFree\n    entryFeeAmount: $entryFeeAmount\n    entryFeeCurrency: $entryFeeCurrency\n    prizePoolAmount: $prizePoolAmount\n    prizePoolCurrency: $prizePoolCurrency\n    prizePoolDisplayEnabled: $prizePoolDisplayEnabled\n    maxPlayers: $maxPlayers\n    formatId: $formatId\n    arenaDurationMinutes: $arenaDurationMinutes\n    prizePayoutMode: $prizePayoutMode\n    prizePlacePercents: $prizePlacePercents\n  ) {\n    id\n    title\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n    formatId\n    arenaDurationMinutes\n    prizePayoutMode\n    prizePlacePercents\n  }\n}": types.CreateTournamentDocument,
    "query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n  }\n}": types.MeDocument,
    "mutation SetFeatureFlag($key: String!, $enabled: Boolean!, $mode: String, $depths: [Int!], $disabledCountries: [String!]) {\n  setFeatureFlag(\n    key: $key\n    enabled: $enabled\n    mode: $mode\n    depths: $depths\n    disabledCountries: $disabledCountries\n  ) {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}": types.SetFeatureFlagDocument,
    "mutation SetTournamentStatus($id: ID!, $status: String!) {\n  setTournamentStatus(id: $id, status: $status) {\n    id\n    status\n  }\n}": types.SetTournamentStatusDocument,
    "query Tournaments {\n  tournaments {\n    id\n    title\n    description\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    prizeImageUrl\n    gallery\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n  }\n}": types.TournamentsDocument,
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
export function graphql(source: "query ConsoleFeatureFlags {\n  consoleFeatureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}"): (typeof documents)["query ConsoleFeatureFlags {\n  consoleFeatureFlags {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateTournament($title: String!, $description: String, $isFree: Boolean, $entryFeeAmount: Float, $entryFeeCurrency: String, $prizePoolAmount: Float, $prizePoolCurrency: String, $prizePoolDisplayEnabled: Boolean, $maxPlayers: Int, $formatId: String, $arenaDurationMinutes: Int, $prizePayoutMode: String, $prizePlacePercents: String) {\n  createTournament(\n    title: $title\n    description: $description\n    isFree: $isFree\n    entryFeeAmount: $entryFeeAmount\n    entryFeeCurrency: $entryFeeCurrency\n    prizePoolAmount: $prizePoolAmount\n    prizePoolCurrency: $prizePoolCurrency\n    prizePoolDisplayEnabled: $prizePoolDisplayEnabled\n    maxPlayers: $maxPlayers\n    formatId: $formatId\n    arenaDurationMinutes: $arenaDurationMinutes\n    prizePayoutMode: $prizePayoutMode\n    prizePlacePercents: $prizePlacePercents\n  ) {\n    id\n    title\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n    formatId\n    arenaDurationMinutes\n    prizePayoutMode\n    prizePlacePercents\n  }\n}"): (typeof documents)["mutation CreateTournament($title: String!, $description: String, $isFree: Boolean, $entryFeeAmount: Float, $entryFeeCurrency: String, $prizePoolAmount: Float, $prizePoolCurrency: String, $prizePoolDisplayEnabled: Boolean, $maxPlayers: Int, $formatId: String, $arenaDurationMinutes: Int, $prizePayoutMode: String, $prizePlacePercents: String) {\n  createTournament(\n    title: $title\n    description: $description\n    isFree: $isFree\n    entryFeeAmount: $entryFeeAmount\n    entryFeeCurrency: $entryFeeCurrency\n    prizePoolAmount: $prizePoolAmount\n    prizePoolCurrency: $prizePoolCurrency\n    prizePoolDisplayEnabled: $prizePoolDisplayEnabled\n    maxPlayers: $maxPlayers\n    formatId: $formatId\n    arenaDurationMinutes: $arenaDurationMinutes\n    prizePayoutMode: $prizePayoutMode\n    prizePlacePercents: $prizePlacePercents\n  ) {\n    id\n    title\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n    formatId\n    arenaDurationMinutes\n    prizePayoutMode\n    prizePlacePercents\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    username\n    role\n    rating\n    xp\n    wins\n    losses\n    draws\n    avatarThumbUrl\n    avatarFullUrl\n    region\n    countryCode\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SetFeatureFlag($key: String!, $enabled: Boolean!, $mode: String, $depths: [Int!], $disabledCountries: [String!]) {\n  setFeatureFlag(\n    key: $key\n    enabled: $enabled\n    mode: $mode\n    depths: $depths\n    disabledCountries: $disabledCountries\n  ) {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}"): (typeof documents)["mutation SetFeatureFlag($key: String!, $enabled: Boolean!, $mode: String, $depths: [Int!], $disabledCountries: [String!]) {\n  setFeatureFlag(\n    key: $key\n    enabled: $enabled\n    mode: $mode\n    depths: $depths\n    disabledCountries: $disabledCountries\n  ) {\n    vsAiEnabled\n    otpRequired\n    cashRmgEnabled\n    cashPhoneKycRequired\n    cashPhoneOtpRequired\n    cashRmgDisabledCountries\n    ethiopiaPaymentMode\n    aiDepths\n    hostedEventsEnabled\n    publicEventsEnabled\n    publicEventMatchesRated\n    prizePoolDisplayEnabled\n    prizePoolGuaranteeEnabled\n    kycAutoApprove\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SetTournamentStatus($id: ID!, $status: String!) {\n  setTournamentStatus(id: $id, status: $status) {\n    id\n    status\n  }\n}"): (typeof documents)["mutation SetTournamentStatus($id: ID!, $status: String!) {\n  setTournamentStatus(id: $id, status: $status) {\n    id\n    status\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Tournaments {\n  tournaments {\n    id\n    title\n    description\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    prizeImageUrl\n    gallery\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n  }\n}"): (typeof documents)["query Tournaments {\n  tournaments {\n    id\n    title\n    description\n    isFree\n    entryFeeAmount\n    entryFeeCurrency\n    prizePoolAmount\n    prizePoolCurrency\n    prizeImageUrl\n    gallery\n    status\n    prizePoolDisplayEnabled\n    maxPlayers\n    seatCapUnlimited\n    prizePoolNow\n    prizePoolIfFull\n    prizePoolGuaranteeAmount\n    prizePoolFrozen\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;