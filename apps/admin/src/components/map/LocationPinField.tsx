"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, LocateFixed, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

const LocationMap = dynamic(() => import("@/components/map/map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)]">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--dama-muted)]" />
    </div>
  ),
});

export type LocationPinFieldChrome = {
  sectionTitle: string;
  mapPinEmpty: string;
  /** Shown when required and no pin yet (BranchLocationPinField required subtitle). */
  mapPinRequiredHint: string;
  useDeviceLocation: string;
  clearPin: string;
  helperText: string;
  geolocationUnavailable: string;
  geolocationFailed: string;
  /** Template with `{lat}` and `{lng}` placeholders. */
  pinCoordsFmt: string;
};

export interface LocationPinFieldProps {
  latitude: number | null;
  longitude: number | null;
  onPinChange: (latitude: number, longitude: number) => void;
  onPinClear?: () => void;
  pinTitle: string;
  pinId?: string | number;
  mapHeightClassName?: string;
  error?: string;
  required?: boolean;
  chrome: LocationPinFieldChrome;
}

export function LocationPinField({
  latitude,
  longitude,
  onPinChange,
  onPinClear,
  pinTitle,
  pinId = "location-pin",
  mapHeightClassName = "h-[280px]",
  error,
  required = false,
  chrome,
}: LocationPinFieldProps) {
  const hasMapPin = latitude != null && longitude != null;

  const mapListings = useMemo(() => {
    if (!hasMapPin) return [];
    return [
      {
        id: pinId,
        lat: latitude,
        lng: longitude,
        title: pinTitle,
      },
    ];
  }, [hasMapPin, latitude, longitude, pinId, pinTitle]);

  const pinCoordsLabel = useMemo(() => {
    if (!hasMapPin) return "";
    const fmt = (chrome.pinCoordsFmt || "").trim();
    if (!fmt) return "";
    return fmt.replace("{lat}", latitude.toFixed(6)).replace("{lng}", longitude.toFixed(6));
  }, [chrome.pinCoordsFmt, hasMapPin, latitude, longitude]);

  const handleUseDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = (chrome.geolocationUnavailable || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onPinChange(position.coords.latitude, position.coords.longitude);
      },
      () => {
        const msg = (chrome.geolocationFailed || "").trim();
        if (msg) toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [chrome.geolocationFailed, chrome.geolocationUnavailable, onPinChange]);

  return (
    <div className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-black/5 p-4 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[var(--dama-text)]">
            {(chrome.sectionTitle || "").trim()}
            {required ? <span className="text-[var(--dama-danger)]"> *</span> : null}
          </p>
          <p className="text-[11px] text-[var(--dama-muted)]">
            {hasMapPin
              ? pinCoordsLabel
              : required
                ? (chrome.mapPinRequiredHint || chrome.mapPinEmpty || "").trim()
                : (chrome.mapPinEmpty || "").trim()}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasMapPin && onPinClear ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-[var(--dama-border)] bg-[var(--dama-bg)]/80 text-xs text-[var(--dama-text)] hover:bg-[var(--dama-muted)]/20"
              onClick={onPinClear}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {(chrome.clearPin || "").trim()}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 shrink-0 gap-1.5 rounded-lg border-emerald-500/50 bg-emerald-500/10 text-xs text-emerald-800 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200",
              !hasMapPin && "animate-pulse",
            )}
            onClick={handleUseDeviceLocation}
          >
            <span
              aria-hidden
              className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
              <LocateFixed
                className={cn(
                  "relative h-3.5 w-3.5 drop-shadow-[0_0_6px_rgb(16,185,129)]",
                  !hasMapPin && "motion-safe:animate-bounce",
                )}
              />
            </span>
            {(chrome.useDeviceLocation || "").trim()}
          </Button>
        </div>
      </div>
      <div
        className={`overflow-hidden rounded-xl border border-[var(--dama-border)] ${mapHeightClassName}`}
      >
        <LocationMap listings={mapListings} onPickLocation={onPinChange} />
      </div>
      {(chrome.helperText || "").trim() ? (
        <p className="text-[11px] text-[var(--dama-muted)]">{(chrome.helperText || "").trim()}</p>
      ) : null}
      {error ? (
        <p className="animate-pulse text-[10px] font-bold uppercase tracking-wider text-[var(--dama-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
