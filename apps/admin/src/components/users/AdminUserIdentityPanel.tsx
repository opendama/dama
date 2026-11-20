"use client";

import { MediaProofGallery } from "@/components/media/MediaProofGallery";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { CountryFlag } from "@/lib/country-flag";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { cn } from "@/lib/utils";
import type { AdminUserDetail } from "@/types";
import { Check, Copy, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!(label || "").trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--dama-muted)]">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function CopyableDetailRow({
  label,
  value,
  empty,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  empty: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const l = (label || "").trim();
  if (!l) return null;
  const raw = (value || "").trim();
  const display = raw || empty;
  const canCopy = Boolean(raw) && Boolean(copyLabel);
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--dama-muted)]">{l}</p>
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="min-w-0 flex-1 break-words text-sm font-medium">{display}</p>
        {canCopy ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)] text-[var(--dama-muted)] transition-colors hover:text-[var(--dama-fg)]",
            )}
            aria-label={copyLabel}
            title={copyLabel}
            onClick={() => {
              void navigator.clipboard.writeText(raw).then(
                () => {
                  setCopied(true);
                  if (copiedLabel) toast.success(copiedLabel);
                  window.setTimeout(() => setCopied(false), 1600);
                },
                () => {
                  /* fail closed: no invented error toast */
                },
              );
            }}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ContactCopyRow({
  icon: Icon,
  label,
  value,
  empty,
  copyLabel,
  copiedLabel,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  empty: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const l = (label || "").trim();
  if (!l) return null;
  const raw = (value || "").trim();
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(raw) && Boolean(copyLabel);

  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] text-[var(--dama-muted)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--dama-muted)]">{l}</p>
        <p className="truncate text-sm font-medium">{raw || empty}</p>
      </div>
      {canCopy ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] text-[var(--dama-muted)] transition-colors hover:text-[var(--dama-fg)]"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => {
            void navigator.clipboard.writeText(raw).then(
              () => {
                setCopied(true);
                if (copiedLabel) toast.success(copiedLabel);
                window.setTimeout(() => setCopied(false), 1600);
              },
              () => {},
            );
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
    </div>
  );
}

export type AdminUserIdentityChrome = {
  empty_value?: string;
  detail_id_label?: string;
  col_email_label?: string;
  detail_phone_label?: string;
  col_phone_label?: string;
  col_country_label?: string;
  detail_region_label?: string;
  col_rating_label?: string;
  col_xp_label?: string;
  col_record_label?: string;
  col_draws_label?: string;
  col_status_label?: string;
  col_role_label?: string;
  col_created_label?: string;
  active_label?: string;
  disabled_label?: string;
  wins_abbr?: string;
  losses_abbr?: string;
  stats_separator?: string;
  detail_avatar_alt?: string;
  detail_age_kyc_label?: string;
  detail_phone_kyc_label?: string;
  detail_document_kyc_label?: string;
  detail_verified_yes?: string;
  detail_verified_no?: string;
  detail_payout_section?: string;
  detail_payout_empty?: string;
  detail_payout_provider_label?: string;
  detail_payout_account_label?: string;
  detail_payout_phone_label?: string;
  detail_dob_label?: string;
  detail_load_failed?: string;
  contact_section_label?: string;
  copy_action?: string;
  copied_action?: string;
  copy_id_label?: string;
  copy_email_label?: string;
  copy_phone_label?: string;
  host_rep_finished_label?: string;
  host_rep_cancelled_label?: string;
  host_rep_reports_label?: string;
  host_rep_meta_separator?: string;
};

export function AdminUserIdentityPanel({
  user,
  chrome,
  /** When true, skip duplicate avatar header (parent dialog already shows identity band). */
  compactHeader = false,
}: {
  user: AdminUserDetail;
  chrome: AdminUserIdentityChrome;
  compactHeader?: boolean;
}) {
  const empty = (chrome.empty_value || "").trim();
  const avatarAlt = (chrome.detail_avatar_alt || "").trim();
  const verifiedYes = (chrome.detail_verified_yes || "").trim() || empty;
  const verifiedNo = (chrome.detail_verified_no || "").trim() || empty;
  const phoneLabel =
    (chrome.detail_phone_label || "").trim() || (chrome.col_phone_label || "").trim();
  const emailLabel = (chrome.col_email_label || "").trim();
  const contactSection = (chrome.contact_section_label || "").trim();
  const thumb = resolvePublicMediaUrl(user.avatar_thumb_url);
  const full = resolvePublicMediaUrl(user.avatar_full_url);
  const statusLabel =
    (user.is_active ? (chrome.active_label || "").trim() : (chrome.disabled_label || "").trim()) ||
    empty;
  const recordValue =
    [
      user.wins != null ? `${user.wins}${chrome.wins_abbr || ""}` : "",
      user.losses != null ? `${user.losses}${chrome.losses_abbr || ""}` : "",
    ]
      .filter(Boolean)
      .join(chrome.stats_separator || "") || empty;
  const payoutKnown = Array.isArray(user.payout_methods);
  const payouts = payoutKnown ? (user.payout_methods ?? []) : [];
  const payoutSection = (chrome.detail_payout_section || "").trim();
  const payoutLoadFailed = (chrome.detail_load_failed || "").trim();
  const copiedLabel = (chrome.copied_action || "").trim();
  const copyId = (chrome.copy_id_label || chrome.copy_action || "").trim();
  const copyEmail = (chrome.copy_email_label || chrome.copy_action || "").trim();
  const copyPhone = (chrome.copy_phone_label || chrome.copy_action || "").trim();
  const slides = [
    ...(full ? [{ src: full, caption: avatarAlt }] : []),
    ...(thumb && thumb !== full ? [{ src: thumb, caption: avatarAlt }] : []),
  ];

  return (
    <div className="space-y-4">
      {slides.length > 0 ? <MediaProofGallery slides={slides} /> : null}

      {!compactHeader ? (
        <div className="flex flex-wrap items-center gap-3">
          <DamaUserAvatar
            src={thumb || full || null}
            alt={avatarAlt}
            className="h-14 w-14 rounded-full"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex min-w-0 items-center gap-1.5 text-base font-semibold">
              <span className="truncate">{(user.username || "").trim() || empty}</span>
              <CountryFlag code={user.country_code} />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(user.role || "").trim() ? (
                <span className="rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)] px-2 py-0.5 text-xs font-medium">
                  {(user.role || "").trim()}
                </span>
              ) : null}
              {statusLabel ? (
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-medium",
                    user.is_active
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-[var(--dama-border)] bg-[var(--dama-surface)] text-[var(--dama-muted)]",
                  )}
                >
                  {statusLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {contactSection && (emailLabel || phoneLabel) ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {contactSection}
          </h3>
          <div className="divide-y divide-[var(--dama-border)] overflow-hidden rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)]">
            <ContactCopyRow
              icon={Mail}
              label={emailLabel}
              value={(user.email || "").trim()}
              empty={empty}
              copyLabel={copyEmail}
              copiedLabel={copiedLabel}
            />
            <ContactCopyRow
              icon={Phone}
              label={phoneLabel}
              value={(user.primary_phone || "").trim()}
              empty={empty}
              copyLabel={copyPhone}
              copiedLabel={copiedLabel}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <CopyableDetailRow
          label={(chrome.detail_id_label || "").trim()}
          value={(user.id || "").trim()}
          empty={empty}
          copyLabel={copyId}
          copiedLabel={copiedLabel}
        />
        {!contactSection ? (
          <>
            <CopyableDetailRow
              label={emailLabel}
              value={(user.email || "").trim()}
              empty={empty}
              copyLabel={copyEmail}
              copiedLabel={copiedLabel}
            />
            <CopyableDetailRow
              label={phoneLabel}
              value={(user.primary_phone || "").trim()}
              empty={empty}
              copyLabel={copyPhone}
              copiedLabel={copiedLabel}
            />
          </>
        ) : null}
        <DetailRow
          label={(chrome.col_country_label || "").trim()}
          value={(user.country_code || "").trim() || empty}
        />
        <DetailRow
          label={(chrome.detail_region_label || "").trim()}
          value={(user.region || "").trim() || empty}
        />
        <DetailRow
          label={(chrome.col_role_label || "").trim()}
          value={(user.role || "").trim() || empty}
        />
        <DetailRow label={(chrome.col_status_label || "").trim()} value={statusLabel} />
        <DetailRow
          label={(chrome.col_rating_label || "").trim()}
          value={user.rating != null ? String(user.rating) : empty}
        />
        <DetailRow
          label={(chrome.col_xp_label || "").trim()}
          value={user.xp != null ? String(user.xp) : empty}
        />
        <DetailRow label={(chrome.col_record_label || "").trim()} value={recordValue} />
        <DetailRow
          label={(chrome.col_draws_label || "").trim()}
          value={user.draws != null ? String(user.draws) : empty}
        />
        <DetailRow
          label={(chrome.detail_dob_label || "").trim()}
          value={(user.date_of_birth || "").trim() || empty}
        />
        <DetailRow
          label={(chrome.detail_age_kyc_label || "").trim()}
          value={user.age_verified ? verifiedYes : verifiedNo}
        />
        <DetailRow
          label={(chrome.detail_phone_kyc_label || "").trim()}
          value={user.phone_kyc_verified ? verifiedYes : verifiedNo}
        />
        <DetailRow
          label={(chrome.detail_document_kyc_label || "").trim()}
          value={user.document_kyc_verified ? verifiedYes : verifiedNo}
        />
        {(user.host_trust_badge || "").trim() ||
        hostReputationLine({
          finished: user.host_finished_paid_cups,
          cancelled: user.host_cancelled_paid_cups,
          openReports: user.host_open_reports,
          finishedLabel: chrome.host_rep_finished_label,
          cancelledLabel: chrome.host_rep_cancelled_label,
          reportsLabel: chrome.host_rep_reports_label,
          separator: chrome.host_rep_meta_separator,
        }) ? (
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <HostTrustBadge
              label={user.host_trust_badge}
              tier={user.host_trust_tier}
              className="max-w-full"
            />
            {(() => {
              const rep = hostReputationLine({
                finished: user.host_finished_paid_cups,
                cancelled: user.host_cancelled_paid_cups,
                openReports: user.host_open_reports,
                finishedLabel: chrome.host_rep_finished_label,
                cancelledLabel: chrome.host_rep_cancelled_label,
                reportsLabel: chrome.host_rep_reports_label,
                separator: chrome.host_rep_meta_separator,
              });
              return rep ? (
                <p className="text-[11px] text-[var(--dama-muted)]" title={rep}>
                  {rep}
                </p>
              ) : null;
            })()}
          </div>
        ) : null}
        <DetailRow
          label={(chrome.col_created_label || "").trim()}
          value={user.created_at ? new Date(user.created_at).toLocaleString() : empty}
        />
      </div>

      {payoutSection ? (
        <div className="space-y-2 border-t border-[var(--dama-border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {payoutSection}
          </h3>
          {!payoutKnown ? (
            payoutLoadFailed ? (
              <p className="text-sm text-[var(--dama-danger)]" role="alert">
                {payoutLoadFailed}
              </p>
            ) : null
          ) : payouts.length === 0 ? (
            <p className="text-sm text-[var(--dama-muted)]">
              {(chrome.detail_payout_empty || "").trim() || empty}
            </p>
          ) : (
            <ul className="space-y-2">
              {payouts.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] px-3 py-2"
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    <CopyableDetailRow
                      label={(chrome.detail_payout_provider_label || "").trim()}
                      value={(m.provider || "").trim()}
                      empty={empty}
                      copyLabel={(chrome.copy_action || "").trim()}
                      copiedLabel={copiedLabel}
                    />
                    <CopyableDetailRow
                      label={(chrome.detail_payout_account_label || "").trim()}
                      value={(m.account_name || "").trim()}
                      empty={empty}
                      copyLabel={(chrome.copy_action || "").trim()}
                      copiedLabel={copiedLabel}
                    />
                    <CopyableDetailRow
                      label={(chrome.detail_payout_phone_label || "").trim()}
                      value={(m.phone || "").trim()}
                      empty={empty}
                      copyLabel={copyPhone}
                      copiedLabel={copiedLabel}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
