"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { EventCupLobby } from "@/components/events/EventCupLobby";
import { eventGalleryImages } from "@/components/events/EventMiniCard";
import { EventStandingsTable } from "@/components/events/EventStandingsTable";
import { PaymentEventJoinModal } from "@/components/events/PaymentEventJoinModal";
import { ReportEventDialog } from "@/components/events/ReportEventDialog";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EventsJoinSkeleton, ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useCheckoutMutation } from "@/hooks/mutation/useCheckoutMutation";
import {
  type JoinHostedEventError,
  useJoinHostedEventMutation,
} from "@/hooks/mutation/useJoinHostedEventMutation";
import { useCashEligibilityQuery } from "@/hooks/query/useCashEligibilityQuery";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useEventBracketQuery } from "@/hooks/query/useEventBracketQuery";
import { useEventByCodeQuery } from "@/hooks/query/useEventByCodeQuery";
import { useEventEntriesQuery } from "@/hooks/query/useEventEntriesQuery";
import { useEventQuery } from "@/hooks/query/useEventQuery";
import { useEventStandingsQuery } from "@/hooks/query/useEventStandingsQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useEventsPlayerChromeQuery } from "@/hooks/query/useEventsPlayerChromeQuery";
import { useJoinedEventsQuery } from "@/hooks/query/useJoinedEventsQuery";
import { usePaymentModalChromeQuery } from "@/hooks/query/usePaymentModalChromeQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { cashJurisdictionLockMessage, isCashJurisdictionLocked } from "@/lib/cash-jurisdiction";
import { chromeSeparator } from "@/lib/chrome-separator";
import {
  softCommunityBracketTitle,
  softCommunityCarouselAria,
  softCommunityChromeUnavailable,
  softCommunityCodeLabel,
  softCommunityCodePlaceholder,
  softCommunityFeatureDisabled,
  softCommunityJoinBlurb,
  softCommunityJoinStatusMessage,
  softCommunityJoinTitle,
  softCommunityKickedBlurb,
  softCommunityLoadFailed,
  softCommunityPublicListBlurb,
  softCommunityPublicListTitle,
  softCommunityReportAction,
  softCommunityReportNoteLabel,
  softCommunityReportReasonLabel,
  softCommunityReportSubmitAction,
  softCommunityReportTitle,
  softCommunityResultCardDownloadAction,
  softCommunityResultCardShareImageAction,
  softCommunityShareResultAction,
  softCommunitySpectateAction,
  softCommunityVisibilityPrivateBlurb,
  softCommunityVisibilityPublicBlurb,
  softCommunityWinnersTitle,
  softTournamentsFreeLabel,
  softTournamentsJoinAction,
  softTournamentsPlayersLabel,
} from "@/lib/community-player-chrome-soft";
import { shouldOpenEventCupLobby } from "@/lib/event-cup-lobby";
import { eventJoinErrorChrome, isAlreadyJoinedEventError } from "@/lib/event-join-error";
import { bracketChromeFrom } from "@/lib/events-bracket-chrome";
import { buildBracketSections } from "@/lib/events-bracket-sections";
import { catalogHostedFeatureOff } from "@/lib/events-catalog-gate";
import { eventsLoadingBlockHeight } from "@/lib/events-dialog-shell-style";
import {
  buildResultCardBlob,
  buildResultCardText,
  shareOrDownloadResultCard,
} from "@/lib/events-result-card";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { hostedEventPrizePoolLines, prizePoolCardLabelsFromPlayer } from "@/lib/prize-pool-lines";
import { parsePositiveDecimal, sanitizeDecimalInput } from "@/lib/sanitize-decimal-input";
import { seatCapFillRight } from "@/lib/seat-cap-display";
import { eventJoinPlayHref } from "@/lib/tournament-free-join";
import { withWalletFocusParam } from "@/lib/wallet-focus-href";
import { useAuthStore } from "@/store/auth";
import { isCashRmgChromeReady } from "@/types/cash-rmg";
import type { HostedEvent } from "@/types/events";
import { isEventsPlayerChromeReady } from "@/types/events-player-chrome";
import { isPaymentModalChromeReady } from "@/types/payment-modal-chrome";
import type { ClientEnums } from "@/types/platform";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  initialCode?: string;
  /** Deep-link seated community cup (`/?view=tournaments&source=community&id=`). */
  initialEventId?: string;
};

export function EventsJoinPanel({ initialCode = "", initialEventId = "" }: Props) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const myUserId = (useAuthStore((s) => s.user?.id) || "").trim();
  const signInModal = useOptionalSignInModal();
  const chromeQuery = useEventsPlayerChromeQuery(true);
  const chrome = isEventsPlayerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const catalogQuery = useEventsCatalogQuery(true);
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const joinedQuery = useJoinedEventsQuery(
    token,
    pageSize > 0 ? Math.max(pageSize, 50) : 0,
    Boolean(token) && Boolean(chrome) && pageSize > 0,
  );
  /** Optimistic seats until /events/joined catches up (paginated miss parity with hub). */
  const [localJoinedIds, setLocalJoinedIds] = useState<Set<string>>(() => new Set());
  const markJoined = useCallback((id: string) => {
    const next = id.trim();
    if (!next) return;
    setLocalJoinedIds((prev) => {
      if (prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
  }, []);
  const joinedIds = useMemo(() => {
    const ids = new Set(localJoinedIds);
    for (const row of joinedQuery.data?.events ?? []) {
      const id = (row.id || "").trim();
      if (id) ids.add(id);
    }
    return ids;
  }, [joinedQuery.data?.events, localJoinedIds]);
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [joinedStatus, setJoinedStatus] = useState<string | null>(null);
  /** Paid confirm-join modal (tournament PaymentEnrollModal parity). */
  const [payJoinEvent, setPayJoinEvent] = useState<HostedEvent | null>(null);
  const [cupLobbyDismissed, setCupLobbyDismissed] = useState(false);
  const reportDialog = useDeferredDialogValue<HostedEvent>();

  useEffect(() => {
    const next = initialCode.trim().toUpperCase();
    if (next) setCode(next);
  }, [initialCode]);

  const lookupCode = code.trim().toUpperCase();
  const eventQuery = useEventByCodeQuery(lookupCode, Boolean(lookupCode) && lookupCode.length >= 3);
  const event = eventQuery.data;
  const focusId = (initialEventId || "").trim() || (event?.id || "").trim();
  const focusEventQuery = useEventQuery(focusId, Boolean(focusId));
  const focusEntriesQuery = useEventEntriesQuery(
    token,
    focusId,
    Boolean(token) && Boolean(focusId),
  );
  const seatedFromEntries = useMemo(() => {
    if (!focusId || !myUserId) return false;
    return (focusEntriesQuery.data ?? []).some(
      (e) => (e.user_id || "").trim() === myUserId && (e.event_id || "").trim() === focusId,
    );
  }, [focusId, myUserId, focusEntriesQuery.data]);

  const lobbyEventId = useMemo(() => {
    const fromLink = (initialEventId || "").trim();
    const fromLookup = (event?.id || "").trim();
    const candidate = fromLink || fromLookup;
    if (!candidate) return "";
    const seated =
      joinedIds.has(candidate) ||
      (candidate === focusId && seatedFromEntries) ||
      Boolean(joinedStatus && candidate === fromLookup);
    const detail = focusEventQuery.data?.id === candidate ? focusEventQuery.data : event;
    if (!shouldOpenEventCupLobby(detail ?? event, seated)) return "";
    return candidate;
  }, [
    initialEventId,
    event,
    joinedIds,
    focusId,
    seatedFromEntries,
    joinedStatus,
    focusEventQuery.data,
  ]);

  const bracketQuery = useEventBracketQuery(
    event?.id,
    Boolean(event?.id) && Boolean(joinedStatus || event),
  );
  const standingsQuery = useEventStandingsQuery(
    event?.id,
    Boolean(event?.id) && Boolean(joinedStatus || event?.finished_at),
  );
  const entriesQuery = useEventEntriesQuery(token, event?.id, Boolean(event?.id));
  const placedEntries = (entriesQuery.data ?? [])
    .filter((e) => typeof e.placement === "number")
    .slice()
    .sort((a, b) => (a.placement as number) - (b.placement as number));
  const showStandings = Boolean(event?.finished_at) || placedEntries.length > 0;

  const geoQuery = useDetectBrowserCountryQuery(Boolean(token) && needsTopUp);
  const eligibilityQuery = useCashEligibilityQuery(token, Boolean(token) && needsTopUp);
  const country = (eligibilityQuery.data?.country_code || geoQuery.data || "").trim();
  const walletQuery = useWalletQuery(token, Boolean(token) && needsTopUp && Boolean(country));
  const routeQuery = usePaymentRouteQuery(needsTopUp && Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const payChromeQuery = usePaymentModalChromeQuery(needsTopUp);
  const payChrome = isPaymentModalChromeReady(payChromeQuery.data)
    ? payChromeQuery.data
    : undefined;
  const flagsQuery = useRestFeatureFlagsQuery();
  const cashChromeQuery = useCashRmgChromeQuery(Boolean(token) && needsTopUp);
  const cashChrome = isCashRmgChromeReady(cashChromeQuery.data)
    ? cashChromeQuery.data.chrome
    : undefined;
  const cashPolicy = isCashRmgChromeReady(cashChromeQuery.data)
    ? cashChromeQuery.data.policy
    : undefined;
  const flagsSettled = !flagsQuery.isLoading && (flagsQuery.isFetched || flagsQuery.isError);
  const cashEnabled = flagsQuery.data?.cash_rmg_enabled === true;
  const cashLocked = isCashJurisdictionLocked({
    flagsSettled,
    cashEnabled,
    country,
    policy: cashPolicy,
    disabledCountryCodes: flagsQuery.data?.cash_rmg_disabled_countries,
    eligibility: eligibilityQuery.data,
    eligibilityFetched: eligibilityQuery.isFetched,
  });
  const cashLockMessage = cashJurisdictionLockMessage(cashLocked, country, cashChrome, {
    cashEnabled,
    eligibility: eligibilityQuery.data,
  });
  const join = useJoinHostedEventMutation(token);
  const checkout = useCheckoutMutation(token);

  useEffect(() => {
    if (!needsTopUp || !event || event.is_free_entry || !walletQuery.data) return;
    const fee = event.entry_fee_amount;
    const bal = walletQuery.data.balance;
    if (typeof bal !== "number" || typeof fee !== "number" || bal >= fee) return;
    const shortfall = fee - bal;
    if (shortfall > 0 && !topUpAmount) {
      setTopUpAmount(sanitizeDecimalInput(String(shortfall)));
    }
  }, [needsTopUp, event, walletQuery.data, topUpAmount]);

  if (chromeQuery.isLoading) {
    return <EventsJoinSkeleton />;
  }

  if (!chrome) {
    const unavailable = softCommunityChromeUnavailable(
      (chromeQuery.data?.events_player_chrome_unavailable || "").trim(),
    );
    return unavailable ? (
      <p className="text-sm text-[var(--dama-danger)]" role="alert">
        {unavailable}
      </p>
    ) : null;
  }

  // Hosting Join is community-cup join - gate when hosted cups feature is off (list/dashboard parity).
  if (catalogHostedFeatureOff(catalogQuery.data, catalogQuery.error)) {
    return (
      <output className="block text-sm text-[var(--dama-muted)]">
        {softCommunityFeatureDisabled(chrome.feature_disabled)}
      </output>
    );
  }

  const onJoin = () => {
    if (!token) {
      signInModal?.openSignIn({
        nextPath: `/?view=tournaments&source=community&code=${encodeURIComponent(lookupCode)}`,
      });
      return;
    }
    if (!lookupCode) return;
    // Paid looked-up event: confirm fee from wallet first (tournament enroll parity).
    if (event && !event.is_free_entry) {
      if (joinedIds.has(event.id)) {
        markJoined(event.id);
        router.replace(eventJoinPlayHref(event.id));
        return;
      }
      setPayJoinEvent(event);
      return;
    }
    setNeedsTopUp(false);
    join.mutate(
      { code: lookupCode, country_code: country || undefined },
      {
        onSuccess: (data) => {
          setJoinedStatus(data.entry?.status || "");
          const pending = (catalogQuery.data?.hosted_event_entry_pending || "").trim();
          const isPending = Boolean(pending && data.entry?.status === pending);
          toast.success(
            softCommunityJoinStatusMessage(
              isPending ? chrome.pending_approval : chrome.approved_blurb,
            ),
          );
          // Approved seat → event cup lobby (not bare Play home).
          if (!isPending) {
            const lobbyId = (data.event?.id || event?.id || "").trim();
            if (lobbyId) markJoined(lobbyId);
            router.replace(eventJoinPlayHref(lobbyId || undefined));
          }
        },
        onError: (err) => {
          if (isAlreadyJoinedEventError(err)) {
            const msg = softCommunityJoinStatusMessage(
              (chrome.already_joined || "").trim() || (chrome.approved_blurb || "").trim(),
            );
            if (msg) toast.success(msg);
            const approved = (catalogQuery.data?.hosted_event_entry_approved || "").trim();
            if (approved) setJoinedStatus(approved);
            if (event?.id) markJoined(event.id);
            void entriesQuery.refetch();
            void eventQuery.refetch();
            router.replace(eventJoinPlayHref(event?.id));
            return;
          }
          const payment = (err as JoinHostedEventError).paymentRequired;
          if (payment) {
            setNeedsTopUp(true);
            return;
          }
          const msg = eventJoinErrorChrome(err, chrome);
          if (msg) toast.error(msg);
        },
      },
    );
  };

  const statusBlurb = (() => {
    const s = (joinedStatus || "").trim();
    if (!s) return "";
    const pending = (catalogQuery.data?.hosted_event_entry_pending || "").trim();
    const approved = (catalogQuery.data?.hosted_event_entry_approved || "").trim();
    const rejected = (catalogQuery.data?.hosted_event_entry_rejected || "").trim();
    const kicked = (catalogQuery.data?.hosted_event_entry_kicked || "").trim();
    if (pending && s === pending) {
      return softCommunityJoinStatusMessage(chrome.pending_approval);
    }
    if (approved && s === approved) {
      return softCommunityJoinStatusMessage(chrome.approved_blurb);
    }
    if (rejected && s === rejected) {
      return softCommunityJoinStatusMessage(chrome.rejected_blurb);
    }
    if (kicked && s === kicked) return softCommunityKickedBlurb(chrome.kicked_blurb);
    return "";
  })();

  const topUpValid = parsePositiveDecimal(topUpAmount) != null;
  const publicEnabled = catalogQuery.data?.public_events_enabled === true;
  const reasonCodes = catalogQuery.data?.report_reason_codes ?? [];
  const reasonLabels = catalogQuery.data?.report_reason_labels ?? {};
  const publicVis = (catalogQuery.data?.hosted_event_public_visibility || "").trim();
  const privateVis = (catalogQuery.data?.hosted_event_private_visibility || "").trim();
  const visibilityBlurb =
    publicVis && event?.visibility === publicVis
      ? softCommunityVisibilityPublicBlurb(chrome.visibility_public_blurb)
      : privateVis && event?.visibility === privateVis
        ? softCommunityVisibilityPrivateBlurb(chrome.visibility_private_blurb)
        : "";
  const ratedBlurb =
    publicVis && event?.visibility === publicVis
      ? softCommunityJoinStatusMessage(
          catalogQuery.data?.public_event_matches_rated === true
            ? chrome.public_rated_on_blurb
            : chrome.public_rated_off_blurb,
        )
      : "";
  const catalogPhaseEnums = {
    hosted_event_phase_knockout: catalogQuery.data?.hosted_event_phase_knockout,
    hosted_event_phase_round_robin: catalogQuery.data?.hosted_event_phase_round_robin,
    hosted_event_phase_swiss: catalogQuery.data?.hosted_event_phase_swiss,
    hosted_event_phase_group: catalogQuery.data?.hosted_event_phase_group,
  } as ClientEnums;

  const cardPad = Number((chrome.dialog_shell_inset_h || "").trim());
  const loadH = eventsLoadingBlockHeight(chrome);
  // Full portal width (layout max-w-[1400px]) - do not shrink with dialog panel_max_width.
  if (!Number.isFinite(cardPad) || cardPad < 0 || loadH == null) {
    return null;
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {softCommunityJoinTitle(chrome.join_title)}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--dama-muted)]">
          {softCommunityJoinBlurb(chrome.join_blurb)}
        </p>
      </div>

      <Field id="events-join-code" label={softCommunityCodeLabel(chrome.code_label)}>
        <Input
          id="events-join-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setJoinedStatus(null);
            setNeedsTopUp(false);
          }}
          placeholder={softCommunityCodePlaceholder(chrome.code_placeholder)}
          autoComplete="off"
          className="uppercase tracking-wider"
        />
      </Field>

      {eventQuery.isFetching && lookupCode.length >= 3 ? (
        <ShimmerBlock className="w-full rounded-md" style={{ height: loadH }} />
      ) : null}

      {eventQuery.isError && lookupCode.length >= 3 ? (
        <p className="text-sm text-[var(--dama-danger)]">
          {softCommunityLoadFailed(chrome.load_failed)}
        </p>
      ) : null}

      {event ? (
        <div
          className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] text-sm"
          style={{ padding: cardPad }}
        >
          {(() => {
            const detailEv = focusEventQuery.data?.id === event.id ? focusEventQuery.data : event;
            const images = eventGalleryImages(detailEv);
            const brand = (detailEv.brand_color || "").trim();
            if (images.length === 0 && !brand) return null;
            return (
              <div
                className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-[var(--dama-surface)]"
                style={images.length === 0 && brand ? { backgroundColor: brand } : undefined}
              >
                {images.length > 0 ? (
                  <GalleryCarousel
                    images={images}
                    ariaLabel={softCommunityCarouselAria(chrome.carousel_aria)}
                    className="absolute inset-0 h-full w-full"
                  />
                ) : null}
              </div>
            );
          })()}
          <p className="font-medium">{event.title}</p>
          <p className="mt-1 text-[var(--dama-muted)]">
            {(event.status_label || "").trim() || (chrome.empty_value || "").trim()}
          </p>
          {(() => {
            const detailEv = focusEventQuery.data?.id === event.id ? focusEventQuery.data : event;
            const desc = (detailEv.description || "").trim();
            const descLabel = (chrome.detail_description_label || "").trim();
            if (!desc) return null;
            return (
              <div className="mt-1 space-y-0.5">
                {descLabel ? <p className="text-xs text-[var(--dama-muted)]">{descLabel}</p> : null}
                <p className="whitespace-pre-wrap text-[var(--dama-text)]">{desc}</p>
              </div>
            );
          })()}
          {visibilityBlurb ? (
            <p className="mt-1 text-[var(--dama-muted)]">{visibilityBlurb}</p>
          ) : null}
          {ratedBlurb ? (
            <p className="mt-1 text-xs text-[var(--dama-muted)]">{ratedBlurb}</p>
          ) : null}
          {event.is_free_entry ? (
            <p className="mt-1 font-mono text-[var(--dama-gold)]">
              {softTournamentsFreeLabel(chrome.free_label) || (chrome.empty_value || "").trim()}
            </p>
          ) : (
            <>
              <p className="mt-1 font-mono text-[var(--dama-gold)]">
                {typeof event.entry_fee_amount === "number"
                  ? event.entry_fee_amount
                  : (chrome.empty_value || "").trim()}
                {chrome.amount_currency_separator}
                {(event.entry_fee_currency || "").trim() || (chrome.empty_value || "").trim()}
              </p>
              {(() => {
                const payBlurb = softCommunityJoinStatusMessage(chrome.entry_fee_pay_blurb);
                return payBlurb ? (
                  <p className="mt-1 text-xs text-[var(--dama-muted)]">{payBlurb}</p>
                ) : null;
              })()}
            </>
          )}
          {(() => {
            const poolLines = hostedEventPrizePoolLines(
              event,
              prizePoolCardLabelsFromPlayer(chrome),
            );
            if (poolLines.length === 0) return null;
            return (
              <div className="mt-1 space-y-0.5">
                {poolLines.map((line) => (
                  <p key={line} className="text-sm font-medium text-[var(--dama-text)]">
                    {line}
                  </p>
                ))}
              </div>
            );
          })()}
          {(() => {
            const empty = (chrome.empty_value || "").trim();
            const approved =
              typeof event.approved_count === "number" && Number.isFinite(event.approved_count)
                ? String(event.approved_count)
                : empty;
            const playersLbl = softTournamentsPlayersLabel(chrome.players_label);
            const fillRight = seatCapFillRight(
              event.max_players,
              event.seat_cap_unlimited,
              chrome.unlimited_players_label || "",
            );
            const playersLine = fillRight
              ? `${approved}/${fillRight} ${playersLbl}`.trim()
              : `${approved} ${playersLbl}`.trim();
            return (
              <p className="mt-1 text-xs text-[var(--dama-muted)]" title={playersLine}>
                {playersLine}
              </p>
            );
          })()}
          {token ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => reportDialog.openWith(event)}
            >
              {softCommunityReportAction(chrome.report_action)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {statusBlurb ? <p className="text-sm text-[var(--dama-gold)]">{statusBlurb}</p> : null}

      {needsTopUp && payChrome ? (
        <div
          className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)]"
          style={{ padding: cardPad }}
        >
          {cashLocked ? (
            <p className="text-sm text-[var(--dama-danger)]">
              {cashLockMessage || softCommunityJoinStatusMessage(chrome.insufficient_entry_fee)}
            </p>
          ) : (
            <p className="text-sm text-[var(--dama-danger)]">
              {softCommunityJoinStatusMessage(chrome.insufficient_entry_fee)}
            </p>
          )}
          {cashLocked ? null : isManual ? (
            (chrome.top_up_href || "").trim() ? (
              <Button asChild variant="gold">
                <Link href={withWalletFocusParam(chrome.top_up_href, "topup")}>
                  {chrome.top_up_action}
                </Link>
              </Button>
            ) : null
          ) : (
            <>
              <Field id="events-join-topup" label={payChrome.amount_label}>
                <AmountInput
                  id="events-join-topup"
                  value={topUpAmount}
                  onValueChange={setTopUpAmount}
                  placeholder={payChrome.amount_placeholder}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="gold"
                  disabled={!country || !topUpValid}
                  isLoading={checkout.isPending}
                  pendingLabel={payChrome.checkout_pending}
                  onClick={() => {
                    if (cashLocked) {
                      if (cashLockMessage) toast.error(cashLockMessage);
                      return;
                    }
                    const n = parsePositiveDecimal(topUpAmount);
                    if (n == null || !country) return;
                    checkout.mutate({
                      amount: n,
                      purpose: "wallet_topup",
                      country_code: country,
                    });
                  }}
                >
                  {payChrome.checkout_action}
                </Button>
                <Button asChild variant="outline">
                  <Link href={chrome.top_up_href}>{chrome.top_up_action}</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : needsTopUp ? (
        <Button asChild variant="gold">
          <Link href={chrome.top_up_href}>{chrome.top_up_action}</Link>
        </Button>
      ) : null}

      {!token ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : (
        <Button
          type="button"
          variant="gold"
          disabled={!lookupCode || join.isPending}
          isLoading={join.isPending}
          onClick={onJoin}
        >
          {softTournamentsJoinAction(chrome.join_action)}
        </Button>
      )}

      {placedEntries.length > 0 ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[var(--dama-gold)]">
              {softCommunityWinnersTitle(chrome.winners_title)}
            </h2>
            <div className="flex flex-wrap gap-2">
              {(chrome.share_result_action || "").trim() ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const text = buildResultCardText({
                      title: (event?.title || "").trim(),
                      winnersTitle: softCommunityWinnersTitle(chrome.winners_title),
                      logoUrl: event?.logo_url,
                      sponsorName: event?.sponsor_name,
                      sponsorLogoUrl: event?.sponsor_logo_url,
                      placements: placedEntries.map((e) => ({
                        placement: e.placement as number,
                        username: (e.username || "").trim(),
                      })),
                      emptyValue: chrome.empty_value,
                      metaSeparator: chrome.meta_separator,
                    });
                    try {
                      if (typeof navigator !== "undefined" && navigator.share) {
                        await navigator.share({ text });
                        return;
                      }
                      await navigator.clipboard.writeText(text);
                    } catch {
                      try {
                        await navigator.clipboard.writeText(text);
                      } catch {
                        toast.error(softCommunityLoadFailed(chrome.load_failed));
                      }
                    }
                  }}
                >
                  {softCommunityShareResultAction(chrome.share_result_action)}
                </Button>
              ) : null}
              {(() => {
                const shareImage = softCommunityResultCardShareImageAction(
                  chrome.result_card_share_image_action,
                );
                const downloadImage = softCommunityResultCardDownloadAction(
                  chrome.result_card_download_action,
                );
                const cardFilename = (chrome.result_card_filename || "").trim();
                const imageFailed = (chrome.result_card_image_failed || "").trim();
                const sponsorPrefix = (chrome.result_card_sponsor_prefix || "").trim();
                const cardBg = (chrome.result_card_bg_color || "").trim();
                const cardFg = (chrome.result_card_fg_color || "").trim();
                const cardMuted = (chrome.result_card_muted_color || "").trim();
                const cardRowWash = (chrome.result_card_row_wash_color || "").trim();
                const titleFont = (chrome.result_card_title_font || "").trim();
                const winnersFont = (chrome.result_card_winners_font || "").trim();
                const sponsorFont = (chrome.result_card_sponsor_font || "").trim();
                const placementFont = (chrome.result_card_placement_font || "").trim();
                const nameFont = (chrome.result_card_name_font || "").trim();
                const washAlpha = (chrome.result_card_header_wash_alpha || "").trim();
                const cardWidth = (chrome.result_card_width || "").trim();
                const cardRowH = (chrome.result_card_row_height || "").trim();
                const cardHeaderH = (chrome.result_card_header_height || "").trim();
                const cardSponsorH = (chrome.result_card_sponsor_height || "").trim();
                const cardPlacementsMax = (chrome.result_card_placements_max || "").trim();
                const cardRowRadius = (chrome.result_card_row_radius || "").trim();
                const cardPad = (chrome.result_card_pad || "").trim();
                const cardLogoSize = (chrome.result_card_logo_size || "").trim();
                const cardTitleY = (chrome.result_card_title_y || "").trim();
                const cardWinnersY = (chrome.result_card_winners_y || "").trim();
                const cardBodyGap = (chrome.result_card_body_gap || "").trim();
                const cardRowsTopGap = (chrome.result_card_rows_top_gap || "").trim();
                const cardBottomPad = (chrome.result_card_bottom_pad || "").trim();
                const cardRowInset = (chrome.result_card_row_inset || "").trim();
                const cardRowInnerGap = (chrome.result_card_row_inner_gap || "").trim();
                const cardPlacementX = (chrome.result_card_placement_x || "").trim();
                const cardNameX = (chrome.result_card_name_x || "").trim();
                const cardRowTextY = (chrome.result_card_row_text_y || "").trim();
                const cardSponsorLogoW = (chrome.result_card_sponsor_logo_w || "").trim();
                const cardSponsorLogoH = (chrome.result_card_sponsor_logo_h || "").trim();
                const cardSponsorLogoGap = (chrome.result_card_sponsor_logo_gap || "").trim();
                const cardLogoTextGap = (chrome.result_card_logo_text_gap || "").trim();
                if (
                  !shareImage ||
                  !downloadImage ||
                  !cardFilename ||
                  !imageFailed ||
                  !sponsorPrefix ||
                  !cardBg ||
                  !cardFg ||
                  !cardMuted ||
                  !cardRowWash ||
                  !titleFont ||
                  !winnersFont ||
                  !sponsorFont ||
                  !placementFont ||
                  !nameFont ||
                  !washAlpha ||
                  !cardWidth ||
                  !cardRowH ||
                  !cardHeaderH ||
                  !cardSponsorH ||
                  !cardPlacementsMax ||
                  !cardRowRadius ||
                  !cardPad ||
                  !cardLogoSize ||
                  !cardTitleY ||
                  !cardWinnersY ||
                  !cardBodyGap ||
                  !cardRowsTopGap ||
                  !cardBottomPad ||
                  !cardRowInset ||
                  !cardRowInnerGap ||
                  !cardPlacementX ||
                  !cardNameX ||
                  !cardRowTextY ||
                  !cardSponsorLogoW ||
                  !cardSponsorLogoH ||
                  !cardSponsorLogoGap ||
                  !cardLogoTextGap
                ) {
                  return null;
                }
                const placements = placedEntries.map((e) => ({
                  placement: e.placement as number,
                  username: (e.username || "").trim(),
                }));
                const winnersTitle = softCommunityWinnersTitle(chrome.winners_title);
                const text = buildResultCardText({
                  title: (event?.title || "").trim(),
                  winnersTitle,
                  logoUrl: event?.logo_url,
                  sponsorName: event?.sponsor_name,
                  sponsorLogoUrl: event?.sponsor_logo_url,
                  placements,
                  emptyValue: chrome.empty_value,
                  metaSeparator: chrome.meta_separator,
                });
                const run = async (preferDownload: boolean) => {
                  try {
                    const blob = await buildResultCardBlob({
                      title: (event?.title || "").trim(),
                      logoUrl: event?.logo_url,
                      sponsorName: event?.sponsor_name,
                      sponsorLogoUrl: event?.sponsor_logo_url,
                      brandColor: event?.brand_color,
                      placements,
                      chrome: {
                        winners_title: winnersTitle,
                        result_card_sponsor_prefix: sponsorPrefix,
                        result_card_image_failed: imageFailed,
                        empty_value: chrome.empty_value,
                        meta_separator: chrome.meta_separator,
                        result_card_bg_color: cardBg,
                        result_card_fg_color: cardFg,
                        result_card_muted_color: cardMuted,
                        result_card_row_wash_color: cardRowWash,
                        result_card_title_font: titleFont,
                        result_card_winners_font: winnersFont,
                        result_card_sponsor_font: sponsorFont,
                        result_card_placement_font: placementFont,
                        result_card_name_font: nameFont,
                        result_card_header_wash_alpha: washAlpha,
                        result_card_width: cardWidth,
                        result_card_row_height: cardRowH,
                        result_card_header_height: cardHeaderH,
                        result_card_sponsor_height: cardSponsorH,
                        result_card_placements_max: cardPlacementsMax,
                        result_card_row_radius: cardRowRadius,
                        result_card_pad: cardPad,
                        result_card_logo_size: cardLogoSize,
                        result_card_title_y: cardTitleY,
                        result_card_winners_y: cardWinnersY,
                        result_card_body_gap: cardBodyGap,
                        result_card_rows_top_gap: cardRowsTopGap,
                        result_card_bottom_pad: cardBottomPad,
                        result_card_row_inset: cardRowInset,
                        result_card_row_inner_gap: cardRowInnerGap,
                        result_card_placement_x: cardPlacementX,
                        result_card_name_x: cardNameX,
                        result_card_row_text_y: cardRowTextY,
                        result_card_sponsor_logo_w: cardSponsorLogoW,
                        result_card_sponsor_logo_h: cardSponsorLogoH,
                        result_card_sponsor_logo_gap: cardSponsorLogoGap,
                        result_card_logo_text_gap: cardLogoTextGap,
                      },
                    });
                    if (!blob) {
                      toast.error(imageFailed);
                      return;
                    }
                    if (preferDownload) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = cardFilename;
                      a.click();
                      URL.revokeObjectURL(url);
                      return;
                    }
                    const result = await shareOrDownloadResultCard(blob, cardFilename, {
                      mode: "share",
                      shareActionPresent: true,
                      canShareFiles: true,
                      shareCompanionText: text,
                    });
                    if (result === "failed") toast.error(imageFailed);
                  } catch {
                    toast.error(imageFailed);
                  }
                };
                return (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void run(false)}
                    >
                      {shareImage}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void run(true)}
                    >
                      {downloadImage}
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
          {event?.logo_url || event?.sponsor_logo_url ? (
            <div className="flex flex-wrap items-center gap-3">
              {(() => {
                const previewH = Number((chrome.branding_preview_height || "").trim());
                const previewMaxW = Number((chrome.branding_preview_max_width || "").trim());
                if (
                  !Number.isFinite(previewH) ||
                  previewH <= 0 ||
                  !Number.isFinite(previewMaxW) ||
                  previewMaxW <= 0
                ) {
                  return null;
                }
                return (
                  <>
                    {event?.logo_url ? (
                      <img
                        src={event.logo_url}
                        alt=""
                        className="rounded object-cover"
                        style={{ height: previewH, width: previewH }}
                      />
                    ) : null}
                    {event?.sponsor_logo_url ? (
                      <img
                        src={event.sponsor_logo_url}
                        alt=""
                        className="object-contain"
                        style={{ height: previewH, maxWidth: previewMaxW }}
                      />
                    ) : null}
                  </>
                );
              })()}
              {(event?.sponsor_name || "").trim() ? (
                <span className="text-sm text-[var(--dama-muted)]">
                  {(chrome.result_card_sponsor_prefix || "").trim()
                    ? `${(chrome.result_card_sponsor_prefix || "").trim()} ${(event?.sponsor_name || "").trim()}`
                    : (event?.sponsor_name || "").trim()}
                </span>
              ) : null}
            </div>
          ) : null}
          <ul className="space-y-2 text-sm">
            {placedEntries.map((e) => (
              <li
                key={e.user_id}
                className="flex items-center gap-3 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
              >
                <span className="tabular-nums font-semibold text-[var(--dama-gold)]">
                  {e.placement}
                </span>
                <span>{(e.username || "").trim() || (chrome.empty_value || "").trim()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showStandings ? (
        <EventStandingsTable
          standings={standingsQuery.data?.standings ?? []}
          chrome={chrome}
          loading={standingsQuery.isLoading}
        />
      ) : null}

      {bracketQuery.data && bracketQuery.data.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--dama-gold)]">
            {softCommunityBracketTitle(chrome.bracket_title)}
          </h2>
          <div className="space-y-4 text-sm">
            {buildBracketSections(
              bracketQuery.data,
              bracketChromeFrom(chrome, catalogPhaseEnums),
            ).map((section) => (
              <div key={section.key} className="space-y-2">
                {section.title ? (
                  <p className="text-xs font-semibold text-[var(--dama-muted)]">{section.title}</p>
                ) : null}
                <ul className="space-y-2">
                  {section.matches.map((m) => {
                    const seatA = (m.player_a_username || "").trim();
                    const seatB = (m.player_b_username || "").trim();
                    const winner = (m.winner_username || "").trim();
                    const sep = chromeSeparator(chrome.meta_separator);
                    return (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
                      >
                        <span className="tabular-nums text-[var(--dama-muted)]">
                          {m.round_index + 1}/{m.match_index + 1}
                        </span>
                        <span>
                          {(m.status_label || "").trim() || (chrome.empty_value || "").trim()}
                        </span>
                        {!m.is_bye && (seatA || seatB) ? (
                          <span className="text-[var(--dama-muted)]">
                            {seatA || (chrome.empty_value || "").trim()}
                            {sep}
                            {seatB || (chrome.empty_value || "").trim()}
                          </span>
                        ) : null}
                        {winner ? <span className="text-[var(--dama-gold)]">{winner}</span> : null}
                        {m.game_id ? (
                          <Link
                            href={`/?view=spectate&gameId=${encodeURIComponent(m.game_id)}`}
                            className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
                          >
                            {softCommunitySpectateAction(chrome.spectate_action)}
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {publicEnabled &&
      softCommunityPublicListTitle(chrome.public_list_title) &&
      softCommunityPublicListBlurb(chrome.public_list_blurb) ? (
        <section className="rounded-xl border border-[var(--dama-border)]/80 bg-[var(--dama-panel)]/40 px-3 py-3 sm:px-4">
          <h2 className="text-sm font-semibold text-[var(--dama-text)]">
            {softCommunityPublicListTitle(chrome.public_list_title)}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--dama-muted)]">
            {softCommunityPublicListBlurb(chrome.public_list_blurb)}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/?view=tournaments&source=community">
              {softCommunityPublicListTitle(chrome.public_list_title)}
            </Link>
          </Button>
        </section>
      ) : null}

      {token ? (
        <ReportEventDialog
          open={reportDialog.open}
          onOpenChange={reportDialog.onOpenChange}
          eventId={reportDialog.value?.id ?? null}
          reasonCodes={reasonCodes}
          reasonLabels={reasonLabels}
          emptyValue={chrome.empty_value}
          chrome={{
            report_title: softCommunityReportTitle(chrome.report_title),
            report_reason_label: softCommunityReportReasonLabel(chrome.report_reason_label),
            report_note_label: softCommunityReportNoteLabel(chrome.report_note_label),
            report_submit_action: softCommunityReportSubmitAction(chrome.report_submit_action),
            cancel_action: chrome.cancel_action,
            dialog_shell_max_width: chrome.dialog_shell_max_width,
            dialog_shell_max_height_ratio: chrome.dialog_shell_max_height_ratio,
          }}
          token={token}
          closeLabel={chrome.dialog_close_label}
        />
      ) : null}

      <PaymentEventJoinModal
        open={Boolean(payJoinEvent)}
        onOpenChange={(next) => {
          if (!next) setPayJoinEvent(null);
        }}
        event={payJoinEvent}
        prizePoolLabels={prizePoolCardLabelsFromPlayer(chrome)}
        onJoined={(id) => {
          const approved = (catalogQuery.data?.hosted_event_entry_approved || "").trim();
          if (approved) setJoinedStatus(approved);
          if (id) markJoined(id);
          void joinedQuery.refetch();
          void entriesQuery.refetch();
          void focusEntriesQuery.refetch();
          void eventQuery.refetch();
          if (id) setCode(payJoinEvent?.join_code || code);
        }}
        joinChrome={{
          pending_approval: chrome.pending_approval,
          approved_blurb: chrome.approved_blurb,
          already_joined: chrome.already_joined,
          insufficient_entry_fee: chrome.insufficient_entry_fee,
          top_up_action: chrome.top_up_action,
          top_up_href: chrome.top_up_href,
        }}
      />

      <EventCupLobby
        open={Boolean(lobbyEventId) && !cupLobbyDismissed}
        eventId={lobbyEventId || null}
        chromeRaw={chrome}
        viewerJoined={Boolean(lobbyEventId)}
        onOpenChange={(next) => {
          if (!next) setCupLobbyDismissed(true);
        }}
        closeLabel={chrome.dialog_close_label}
      />
    </div>
  );
}
