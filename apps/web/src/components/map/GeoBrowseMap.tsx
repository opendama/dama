"use client";

import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import type { MapListing } from "./map-leaflet";

const MapComponent = dynamic(() => import("@/components/map/map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(70vh,560px)] items-center justify-center rounded-2xl border border-[var(--dama-border)] bg-[var(--dama-card)]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--dama-muted)] border-t-transparent" />
    </div>
  ),
});

export type GeoBrowsePin = {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
};

export function GeoBrowseMap({
  pins,
  emptyTitle,
  emptyBody,
  listingsCountFmt,
  footerHint,
}: {
  pins: GeoBrowsePin[];
  emptyTitle: string;
  emptyBody: string;
  /** Template `{count}` for map overlay; omit when empty. */
  listingsCountFmt?: string;
  footerHint?: string;
}) {
  if (pins.length === 0) {
    return (
      <div className="flex h-[min(70vh,560px)] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--dama-border)] bg-[var(--dama-card)]/40 px-6 text-center">
        <MapPin className="h-10 w-10 text-[var(--dama-muted)]/40" />
        <div>
          <p className="font-semibold text-[var(--dama-text)]">{(emptyTitle || "").trim()}</p>
          {(emptyBody || "").trim() ? (
            <p className="mt-1 max-w-md text-sm text-[var(--dama-muted)]">
              {(emptyBody || "").trim()}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const listings: MapListing[] = pins.map((pin) => ({
    id: pin.id,
    lat: pin.lat,
    lng: pin.lng,
    latitude: pin.lat,
    longitude: pin.lng,
    title: pin.title,
  }));

  const countFmt = (listingsCountFmt || "").trim();
  const listingsCountLabel = countFmt
    ? countFmt.replace("{count}", String(pins.length))
    : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--dama-border)] shadow-sm [&_.flat-map]:rounded-2xl [&_.leaflet-container]:rounded-2xl">
      <div className="h-[min(70vh,560px)] w-full">
        <MapComponent listings={listings} listingsCountLabel={listingsCountLabel} />
      </div>
      {(footerHint || "").trim() ? (
        <p className="border-t border-[var(--dama-border)] bg-[var(--dama-card)]/40 px-4 py-2 text-xs text-[var(--dama-muted)]">
          {(footerHint || "").trim()}
        </p>
      ) : null}
    </div>
  );
}
