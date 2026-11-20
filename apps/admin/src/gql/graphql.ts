/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AdCampaign = {
  __typename?: 'AdCampaign';
  clicks: Scalars['Int']['output'];
  creativeUrl?: Maybe<Scalars['String']['output']>;
  gallery: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  impressions: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  statusLabel?: Maybe<Scalars['String']['output']>;
  thumbnailUrl?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  uniqueReach: Scalars['Int']['output'];
  videoCompletions: Scalars['Int']['output'];
};

export type ConsoleFeatureFlags = {
  __typename?: 'ConsoleFeatureFlags';
  aiDepths: Array<Scalars['Int']['output']>;
  cashPhoneKycRequired: Scalars['Boolean']['output'];
  cashPhoneOtpRequired: Scalars['Boolean']['output'];
  cashRmgDisabledCountries: Array<Scalars['String']['output']>;
  cashRmgEnabled: Scalars['Boolean']['output'];
  ethiopiaPaymentMode: Scalars['String']['output'];
  hostedEventsEnabled: Scalars['Boolean']['output'];
  kycAutoApprove: Scalars['Boolean']['output'];
  otpRequired: Scalars['Boolean']['output'];
  prizePoolDisplayEnabled: Scalars['Boolean']['output'];
  prizePoolGuaranteeEnabled: Scalars['Boolean']['output'];
  publicEventMatchesRated: Scalars['Boolean']['output'];
  publicEventsEnabled: Scalars['Boolean']['output'];
  vsAiEnabled: Scalars['Boolean']['output'];
};

export type FeatureFlags = {
  __typename?: 'FeatureFlags';
  aiDepths: Array<Scalars['Int']['output']>;
  cashPhoneKycRequired: Scalars['Boolean']['output'];
  cashPhoneOtpRequired: Scalars['Boolean']['output'];
  cashRmgDisabledCountries: Array<Scalars['String']['output']>;
  cashRmgEnabled: Scalars['Boolean']['output'];
  hostedEventsEnabled: Scalars['Boolean']['output'];
  otpRequired: Scalars['Boolean']['output'];
  prizePoolDisplayEnabled: Scalars['Boolean']['output'];
  prizePoolGuaranteeEnabled: Scalars['Boolean']['output'];
  publicEventMatchesRated: Scalars['Boolean']['output'];
  publicEventsEnabled: Scalars['Boolean']['output'];
  vsAiEnabled: Scalars['Boolean']['output'];
};

export type MatchSummary = {
  __typename?: 'MatchSummary';
  finishedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDraw: Scalars['Boolean']['output'];
  isFree: Scalars['Boolean']['output'];
  mode: Scalars['String']['output'];
  moveCount: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createTournament: Tournament;
  setFeatureFlag: ConsoleFeatureFlags;
  setTournamentStatus: Tournament;
};


export type MutationCreateTournamentArgs = {
  arenaDurationMinutes?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  entryFeeAmount?: InputMaybe<Scalars['Float']['input']>;
  entryFeeCurrency?: InputMaybe<Scalars['String']['input']>;
  formatId?: InputMaybe<Scalars['String']['input']>;
  isFree?: InputMaybe<Scalars['Boolean']['input']>;
  maxPlayers?: InputMaybe<Scalars['Int']['input']>;
  prizePayoutMode?: InputMaybe<Scalars['String']['input']>;
  prizePlacePercents?: InputMaybe<Scalars['String']['input']>;
  prizePoolAmount?: InputMaybe<Scalars['Float']['input']>;
  prizePoolCurrency?: InputMaybe<Scalars['String']['input']>;
  prizePoolDisplayEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
};


export type MutationSetFeatureFlagArgs = {
  depths?: InputMaybe<Array<Scalars['Int']['input']>>;
  disabledCountries?: InputMaybe<Array<Scalars['String']['input']>>;
  enabled: Scalars['Boolean']['input'];
  key: Scalars['String']['input'];
  mode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationSetTournamentStatusArgs = {
  id: Scalars['ID']['input'];
  status: Scalars['String']['input'];
};

export type Player = {
  __typename?: 'Player';
  avatarFullUrl?: Maybe<Scalars['String']['output']>;
  avatarThumbUrl?: Maybe<Scalars['String']['output']>;
  countryCode?: Maybe<Scalars['String']['output']>;
  draws: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  levelLabel?: Maybe<Scalars['String']['output']>;
  losses: Scalars['Int']['output'];
  online: Scalars['Boolean']['output'];
  rating: Scalars['Int']['output'];
  recentMatches: Array<MatchSummary>;
  region?: Maybe<Scalars['String']['output']>;
  regionLabel?: Maybe<Scalars['String']['output']>;
  regionalRank?: Maybe<Scalars['Int']['output']>;
  role: Scalars['String']['output'];
  username: Scalars['String']['output'];
  wins: Scalars['Int']['output'];
  xp: Scalars['Int']['output'];
};

export type PublisherDashboard = {
  __typename?: 'PublisherDashboard';
  campaigns: Array<AdCampaign>;
  completionPercent: Scalars['Float']['output'];
  cpc: Scalars['Float']['output'];
  cpcCurrency: Scalars['String']['output'];
  createFeeSpendCurrency: Scalars['String']['output'];
  createFeeSpendSum: Scalars['Float']['output'];
  ctrPercent: Scalars['Float']['output'];
  me?: Maybe<Player>;
  totalClicks: Scalars['Int']['output'];
  totalImpressions: Scalars['Int']['output'];
  totalUniqueReach: Scalars['Int']['output'];
  totalVideoCompletions: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  consoleFeatureFlags: ConsoleFeatureFlags;
  featureFlags: FeatureFlags;
  health: Scalars['String']['output'];
  leaderboard: Array<Player>;
  me?: Maybe<Player>;
  myCampaigns: Array<AdCampaign>;
  player?: Maybe<Player>;
  publisherDashboard: PublisherDashboard;
  tournament?: Maybe<Tournament>;
  tournaments: Array<Tournament>;
};


export type QueryLeaderboardArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPlayerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTournamentArgs = {
  id: Scalars['ID']['input'];
};

export type Tournament = {
  __typename?: 'Tournament';
  arenaDurationMinutes?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  entryFeeAmount: Scalars['Float']['output'];
  entryFeeCurrency: Scalars['String']['output'];
  formatId?: Maybe<Scalars['String']['output']>;
  gallery: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isFree: Scalars['Boolean']['output'];
  maxPlayers?: Maybe<Scalars['Int']['output']>;
  playersCount: Scalars['Int']['output'];
  prizeImageUrl?: Maybe<Scalars['String']['output']>;
  prizePayoutMode?: Maybe<Scalars['String']['output']>;
  prizePlacePercents?: Maybe<Scalars['String']['output']>;
  prizePoolAmount: Scalars['Float']['output'];
  prizePoolCurrency?: Maybe<Scalars['String']['output']>;
  prizePoolDisplayEnabled: Scalars['Boolean']['output'];
  prizePoolFrozen: Scalars['Boolean']['output'];
  prizePoolGuaranteeAmount?: Maybe<Scalars['Float']['output']>;
  prizePoolIfFull?: Maybe<Scalars['Float']['output']>;
  prizePoolNow?: Maybe<Scalars['Float']['output']>;
  /** True when null Unlimited or high Arena safety ceiling (DB swiss ceiling). */
  seatCapUnlimited?: Maybe<Scalars['Boolean']['output']>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type ConsoleFeatureFlagsQueryVariables = Exact<{ [key: string]: never; }>;


export type ConsoleFeatureFlagsQuery = { __typename?: 'Query', consoleFeatureFlags: { __typename?: 'ConsoleFeatureFlags', vsAiEnabled: boolean, otpRequired: boolean, cashRmgEnabled: boolean, cashPhoneKycRequired: boolean, cashPhoneOtpRequired: boolean, cashRmgDisabledCountries: Array<string>, ethiopiaPaymentMode: string, aiDepths: Array<number>, hostedEventsEnabled: boolean, publicEventsEnabled: boolean, publicEventMatchesRated: boolean, prizePoolDisplayEnabled: boolean, prizePoolGuaranteeEnabled: boolean, kycAutoApprove: boolean } };

export type CreateTournamentMutationVariables = Exact<{
  title: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  isFree?: InputMaybe<Scalars['Boolean']['input']>;
  entryFeeAmount?: InputMaybe<Scalars['Float']['input']>;
  entryFeeCurrency?: InputMaybe<Scalars['String']['input']>;
  prizePoolAmount?: InputMaybe<Scalars['Float']['input']>;
  prizePoolCurrency?: InputMaybe<Scalars['String']['input']>;
  prizePoolDisplayEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  maxPlayers?: InputMaybe<Scalars['Int']['input']>;
  formatId?: InputMaybe<Scalars['String']['input']>;
  arenaDurationMinutes?: InputMaybe<Scalars['Int']['input']>;
  prizePayoutMode?: InputMaybe<Scalars['String']['input']>;
  prizePlacePercents?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateTournamentMutation = { __typename?: 'Mutation', createTournament: { __typename?: 'Tournament', id: string, title: string, isFree: boolean, entryFeeAmount: number, entryFeeCurrency: string, prizePoolAmount: number, prizePoolCurrency?: string | null, status: string, prizePoolDisplayEnabled: boolean, maxPlayers?: number | null, seatCapUnlimited?: boolean | null, prizePoolNow?: number | null, prizePoolIfFull?: number | null, prizePoolGuaranteeAmount?: number | null, prizePoolFrozen: boolean, formatId?: string | null, arenaDurationMinutes?: number | null, prizePayoutMode?: string | null, prizePlacePercents?: string | null } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'Player', id: string, username: string, role: string, rating: number, xp: number, wins: number, losses: number, draws: number, avatarThumbUrl?: string | null, avatarFullUrl?: string | null, region?: string | null, countryCode?: string | null } | null };

export type SetFeatureFlagMutationVariables = Exact<{
  key: Scalars['String']['input'];
  enabled: Scalars['Boolean']['input'];
  mode?: InputMaybe<Scalars['String']['input']>;
  depths?: InputMaybe<Array<Scalars['Int']['input']> | Scalars['Int']['input']>;
  disabledCountries?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type SetFeatureFlagMutation = { __typename?: 'Mutation', setFeatureFlag: { __typename?: 'ConsoleFeatureFlags', vsAiEnabled: boolean, otpRequired: boolean, cashRmgEnabled: boolean, cashPhoneKycRequired: boolean, cashPhoneOtpRequired: boolean, cashRmgDisabledCountries: Array<string>, ethiopiaPaymentMode: string, aiDepths: Array<number>, hostedEventsEnabled: boolean, publicEventsEnabled: boolean, publicEventMatchesRated: boolean, prizePoolDisplayEnabled: boolean, prizePoolGuaranteeEnabled: boolean, kycAutoApprove: boolean } };

export type SetTournamentStatusMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  status: Scalars['String']['input'];
}>;


export type SetTournamentStatusMutation = { __typename?: 'Mutation', setTournamentStatus: { __typename?: 'Tournament', id: string, status: string } };

export type TournamentsQueryVariables = Exact<{ [key: string]: never; }>;


export type TournamentsQuery = { __typename?: 'Query', tournaments: Array<{ __typename?: 'Tournament', id: string, title: string, description?: string | null, isFree: boolean, entryFeeAmount: number, entryFeeCurrency: string, prizePoolAmount: number, prizePoolCurrency?: string | null, prizeImageUrl?: string | null, gallery: Array<string>, status: string, prizePoolDisplayEnabled: boolean, maxPlayers?: number | null, seatCapUnlimited?: boolean | null, prizePoolNow?: number | null, prizePoolIfFull?: number | null, prizePoolGuaranteeAmount?: number | null, prizePoolFrozen: boolean }> };


export const ConsoleFeatureFlagsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ConsoleFeatureFlags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"consoleFeatureFlags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"vsAiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"otpRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashRmgEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"cashPhoneKycRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashPhoneOtpRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashRmgDisabledCountries"}},{"kind":"Field","name":{"kind":"Name","value":"ethiopiaPaymentMode"}},{"kind":"Field","name":{"kind":"Name","value":"aiDepths"}},{"kind":"Field","name":{"kind":"Name","value":"hostedEventsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"publicEventsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"publicEventMatchesRated"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolGuaranteeEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"kycAutoApprove"}}]}}]}}]} as unknown as DocumentNode<ConsoleFeatureFlagsQuery, ConsoleFeatureFlagsQueryVariables>;
export const CreateTournamentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTournament"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isFree"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"entryFeeAmount"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"entryFeeCurrency"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prizePoolAmount"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prizePoolCurrency"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPlayers"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"formatId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"arenaDurationMinutes"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prizePayoutMode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prizePlacePercents"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTournament"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"isFree"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isFree"}}},{"kind":"Argument","name":{"kind":"Name","value":"entryFeeAmount"},"value":{"kind":"Variable","name":{"kind":"Name","value":"entryFeeAmount"}}},{"kind":"Argument","name":{"kind":"Name","value":"entryFeeCurrency"},"value":{"kind":"Variable","name":{"kind":"Name","value":"entryFeeCurrency"}}},{"kind":"Argument","name":{"kind":"Name","value":"prizePoolAmount"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prizePoolAmount"}}},{"kind":"Argument","name":{"kind":"Name","value":"prizePoolCurrency"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prizePoolCurrency"}}},{"kind":"Argument","name":{"kind":"Name","value":"prizePoolDisplayEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPlayers"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPlayers"}}},{"kind":"Argument","name":{"kind":"Name","value":"formatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"formatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"arenaDurationMinutes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"arenaDurationMinutes"}}},{"kind":"Argument","name":{"kind":"Name","value":"prizePayoutMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prizePayoutMode"}}},{"kind":"Argument","name":{"kind":"Name","value":"prizePlacePercents"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prizePlacePercents"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isFree"}},{"kind":"Field","name":{"kind":"Name","value":"entryFeeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"entryFeeCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolAmount"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"maxPlayers"}},{"kind":"Field","name":{"kind":"Name","value":"seatCapUnlimited"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolNow"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolIfFull"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolGuaranteeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolFrozen"}},{"kind":"Field","name":{"kind":"Name","value":"formatId"}},{"kind":"Field","name":{"kind":"Name","value":"arenaDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"prizePayoutMode"}},{"kind":"Field","name":{"kind":"Name","value":"prizePlacePercents"}}]}}]}}]} as unknown as DocumentNode<CreateTournamentMutation, CreateTournamentMutationVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}},{"kind":"Field","name":{"kind":"Name","value":"avatarThumbUrl"}},{"kind":"Field","name":{"kind":"Name","value":"avatarFullUrl"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const SetFeatureFlagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetFeatureFlag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"depths"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"disabledCountries"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setFeatureFlag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"mode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mode"}}},{"kind":"Argument","name":{"kind":"Name","value":"depths"},"value":{"kind":"Variable","name":{"kind":"Name","value":"depths"}}},{"kind":"Argument","name":{"kind":"Name","value":"disabledCountries"},"value":{"kind":"Variable","name":{"kind":"Name","value":"disabledCountries"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"vsAiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"otpRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashRmgEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"cashPhoneKycRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashPhoneOtpRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashRmgDisabledCountries"}},{"kind":"Field","name":{"kind":"Name","value":"ethiopiaPaymentMode"}},{"kind":"Field","name":{"kind":"Name","value":"aiDepths"}},{"kind":"Field","name":{"kind":"Name","value":"hostedEventsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"publicEventsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"publicEventMatchesRated"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolGuaranteeEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"kycAutoApprove"}}]}}]}}]} as unknown as DocumentNode<SetFeatureFlagMutation, SetFeatureFlagMutationVariables>;
export const SetTournamentStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetTournamentStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setTournamentStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<SetTournamentStatusMutation, SetTournamentStatusMutationVariables>;
export const TournamentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Tournaments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournaments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isFree"}},{"kind":"Field","name":{"kind":"Name","value":"entryFeeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"entryFeeCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolAmount"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"prizeImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"gallery"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"maxPlayers"}},{"kind":"Field","name":{"kind":"Name","value":"seatCapUnlimited"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolNow"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolIfFull"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolGuaranteeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolFrozen"}}]}}]}}]} as unknown as DocumentNode<TournamentsQuery, TournamentsQueryVariables>;