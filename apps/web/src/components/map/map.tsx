"use client";

import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useState } from "react";
import MapSkeleton from "./MapSkeleton";
import type { MapListing } from "./map-leaflet";

function MapLoadingShell({ children }: { children?: React.ReactNode }) {
  return (
    <section className="flat-map relative h-full w-full" style={{ minHeight: 460 }}>
      <div className="absolute inset-0 z-[1] flex items-center justify-center">
        {children ?? <MapSkeleton />}
      </div>
    </section>
  );
}

// Module-scope dynamic - calling dynamic() inside render remounts Leaflet on every
// pin update and drops markers (map init after ready; listings effect does not re-run).
const MapLeafletDynamic = dynamic(() => import("./map-leaflet"), {
  ssr: false,
  loading: () => <MapLoadingShell />,
});

/**
 * Smart Menu `shared/map.tsx` parity: **always Leaflet** for BranchLocationPinField /
 * LocationPinField. (OpenLayers exists in Smart Menu but is unused by the pin field.)
 * Module-scoped dynamic() so pin updates do not remount the map.
 */
export default function MapComponent({
  listings = [],
  children,
  onPickLocation,
  listingsCountLabel,
}: {
  listings?: MapListing[];
  children?: React.ReactNode;
  onPickLocation?: (lat: number, lng: number) => void;
  listingsCountLabel?: string;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <MapLoadingShell />;
  }

  const hasValidCoords = Array.isArray(listings)
    ? listings.some(
        (l) =>
          l &&
          ((typeof l.lat === "number" && typeof l.lng === "number") ||
            (typeof l.latitude === "number" && typeof l.longitude === "number")),
      )
    : false;
  const effectiveListings = hasValidCoords ? listings : [];

  return (
    <div className="relative z-0 h-full w-full">
      <MapLeafletDynamic
        listings={effectiveListings}
        onPickLocation={onPickLocation}
        listingsCountLabel={listingsCountLabel}
      >
        {children}
      </MapLeafletDynamic>
    </div>
  );
}
