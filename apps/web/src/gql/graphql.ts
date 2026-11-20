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
  kycAutoApprove: Scalars['Boolean']['output'];
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
  hostCancelledPaidCups?: Maybe<Scalars['Int']['output']>;
  hostFinishedPaidCups?: Maybe<Scalars['Int']['output']>;
  hostOpenReports?: Maybe<Scalars['Int']['output']>;
  hostTrustBadge?: Maybe<Scalars['String']['output']>;
  hostTrustTier?: Maybe<Scalars['String']['output']>;
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

export type FeatureFlagsQueryVariables = Exact<{ [key: string]: never; }>;


export type FeatureFlagsQuery = { __typename?: 'Query', featureFlags: { __typename?: 'FeatureFlags', vsAiEnabled: boolean, otpRequired: boolean, cashRmgEnabled: boolean, cashPhoneKycRequired: boolean, cashPhoneOtpRequired: boolean, cashRmgDisabledCountries: Array<string>, hostedEventsEnabled: boolean, publicEventsEnabled: boolean, publicEventMatchesRated: boolean, prizePoolDisplayEnabled: boolean, prizePoolGuaranteeEnabled: boolean, kycAutoApprove: boolean, aiDepths: Array<number> } };

export type LeaderboardQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LeaderboardQuery = { __typename?: 'Query', leaderboard: Array<{ __typename?: 'Player', id: string, username: string, rating: number, xp: number, wins: number, losses: number, draws: number, avatarThumbUrl?: string | null, avatarFullUrl?: string | null, region?: string | null, countryCode?: string | null, online: boolean, regionalRank?: number | null, levelLabel?: string | null, hostTrustTier?: string | null, hostTrustBadge?: string | null }> };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'Player', id: string, username: string, role: string, rating: number, xp: number, wins: number, losses: number, draws: number, avatarThumbUrl?: string | null, avatarFullUrl?: string | null, region?: string | null, countryCode?: string | null, hostTrustTier?: string | null, hostTrustBadge?: string | null, hostFinishedPaidCups?: number | null, hostCancelledPaidCups?: number | null, hostOpenReports?: number | null, recentMatches: Array<{ __typename?: 'MatchSummary', id: string, mode: string, isDraw: boolean, moveCount: number, isFree: boolean, finishedAt: string }> } | null };

export type PublisherDashboardQueryVariables = Exact<{ [key: string]: never; }>;


export type PublisherDashboardQuery = { __typename?: 'Query', publisherDashboard: { __typename?: 'PublisherDashboard', totalImpressions: number, totalClicks: number, totalUniqueReach: number, totalVideoCompletions: number, ctrPercent: number, cpc: number, cpcCurrency: string, completionPercent: number, createFeeSpendSum: number, createFeeSpendCurrency: string, me?: { __typename?: 'Player', id: string, username: string, rating: number, countryCode?: string | null } | null, campaigns: Array<{ __typename?: 'AdCampaign', id: string, title: string, status: string, statusLabel?: string | null, impressions: number, clicks: number, creativeUrl?: string | null }> } };


export const FeatureFlagsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FeatureFlags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"featureFlags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"vsAiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"otpRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashRmgEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"cashPhoneKycRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashPhoneOtpRequired"}},{"kind":"Field","name":{"kind":"Name","value":"cashRmgDisabledCountries"}},{"kind":"Field","name":{"kind":"Name","value":"hostedEventsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"publicEventsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"publicEventMatchesRated"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolDisplayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"prizePoolGuaranteeEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"kycAutoApprove"}},{"kind":"Field","name":{"kind":"Name","value":"aiDepths"}}]}}]}}]} as unknown as DocumentNode<FeatureFlagsQuery, FeatureFlagsQueryVariables>;
export const LeaderboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Leaderboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}},{"kind":"Field","name":{"kind":"Name","value":"avatarThumbUrl"}},{"kind":"Field","name":{"kind":"Name","value":"avatarFullUrl"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"online"}},{"kind":"Field","name":{"kind":"Name","value":"regionalRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelLabel"}},{"kind":"Field","name":{"kind":"Name","value":"hostTrustTier"}},{"kind":"Field","name":{"kind":"Name","value":"hostTrustBadge"}}]}}]}}]} as unknown as DocumentNode<LeaderboardQuery, LeaderboardQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}},{"kind":"Field","name":{"kind":"Name","value":"avatarThumbUrl"}},{"kind":"Field","name":{"kind":"Name","value":"avatarFullUrl"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"hostTrustTier"}},{"kind":"Field","name":{"kind":"Name","value":"hostTrustBadge"}},{"kind":"Field","name":{"kind":"Name","value":"hostFinishedPaidCups"}},{"kind":"Field","name":{"kind":"Name","value":"hostCancelledPaidCups"}},{"kind":"Field","name":{"kind":"Name","value":"hostOpenReports"}},{"kind":"Field","name":{"kind":"Name","value":"recentMatches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"isDraw"}},{"kind":"Field","name":{"kind":"Name","value":"moveCount"}},{"kind":"Field","name":{"kind":"Name","value":"isFree"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const PublisherDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublisherDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publisherDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"campaigns"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"impressions"}},{"kind":"Field","name":{"kind":"Name","value":"clicks"}},{"kind":"Field","name":{"kind":"Name","value":"creativeUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalImpressions"}},{"kind":"Field","name":{"kind":"Name","value":"totalClicks"}},{"kind":"Field","name":{"kind":"Name","value":"totalUniqueReach"}},{"kind":"Field","name":{"kind":"Name","value":"totalVideoCompletions"}},{"kind":"Field","name":{"kind":"Name","value":"ctrPercent"}},{"kind":"Field","name":{"kind":"Name","value":"cpc"}},{"kind":"Field","name":{"kind":"Name","value":"cpcCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"completionPercent"}},{"kind":"Field","name":{"kind":"Name","value":"createFeeSpendSum"}},{"kind":"Field","name":{"kind":"Name","value":"createFeeSpendCurrency"}}]}}]}}]} as unknown as DocumentNode<PublisherDashboardQuery, PublisherDashboardQueryVariables>;