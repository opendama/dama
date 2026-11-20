"use client";

/**
 * Smart Menu `shared/map-leaflet.tsx` parity (CDN Leaflet 1.9.4 + OSM tiles).
 * Pin / browse: fitBounds padding [60,60] maxZoom 10 - never OpenLayers zoom-12.
 * Markers use inline SVG divIcon (no CDN PNG - Next/CDN relative icon paths break).
 */

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type MapListing = Record<string, unknown> & {
  id?: string | number;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  title?: string;
};

type LeafletLatLng = { lat: number; lng: number };
type LeafletClickEvent = { latlng: LeafletLatLng };
type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  on: (event: "click", handler: (e: LeafletClickEvent) => void) => void;
  remove: () => void;
  invalidateSize: () => void;
  fitBounds: (
    bounds: unknown,
    options?: { padding?: [number, number] | [number, number, number, number]; maxZoom?: number },
  ) => void;
};
type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  remove: () => void;
  bindPopup: (html: string) => void;
};
type LeafletIcon = unknown;
type LeafletNamespace = {
  map: (el: HTMLElement) => LeafletMap;
  tileLayer: (
    urlTemplate: string,
    options?: { attribution?: string },
  ) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], options?: { icon?: LeafletIcon }) => LeafletMarker;
  divIcon: (options: {
    className?: string;
    html?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
  }) => LeafletIcon;
  featureGroup: (layers: LeafletMarker[]) => { getBounds: () => unknown };
};

/** Classic Leaflet-blue pin as inline SVG - no external marker-icon.png. */
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41" aria-hidden="true">
  <path fill="#2A81CB" stroke="#1E5A8C" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
  <circle fill="#fff" cx="12.5" cy="12.5" r="5"/>
</svg>`;

function pinIcon(L: LeafletNamespace): LeafletIcon {
  return L.divIcon({
    className: "dama-map-pin",
    html: PIN_SVG,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

function useLeafletCdn() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { L?: LeafletNamespace };
    const cssId = "leaflet-css-cdn";
    const jsId = "leaflet-js-cdn";

    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Kill Leaflet default icon chrome that shows broken <img> when paths fail.
    if (!document.getElementById("dama-leaflet-pin-css")) {
      const style = document.createElement("style");
      style.id = "dama-leaflet-pin-css";
      style.textContent =
        ".dama-map-pin{background:transparent!important;border:none!important}" +
        ".dama-map-pin svg{display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}";
      document.head.appendChild(style);
    }

    if (w.L) {
      setReady(true);
      return;
    }

    if (!document.getElementById(jsId)) {
      const script = document.createElement("script");
      script.id = jsId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => setReady(true);
      script.onerror = () => setReady(false);
      document.body.appendChild(script);
    } else {
      const t = setTimeout(() => setReady(!!w.L), 50);
      return () => clearTimeout(t);
    }
  }, []);

  return ready;
}

export default function MapLeaflet({
  listings = [],
  onPickLocation,
  listingsCountLabel,
  children,
}: {
  listings?: MapListing[];
  onPickLocation?: (lat: number, lng: number) => void;
  listingsCountLabel?: string;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const onPickLocationRef = useRef(onPickLocation);
  const ready = useLeafletCdn();
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onPickLocationRef.current = onPickLocation;
  }, [onPickLocation]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const L = (window as unknown as { L?: LeafletNamespace }).L;
    if (!L) return;

    const map = L.map(containerRef.current).setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    if (onPickLocationRef.current) {
      map.on("click", (e: LeafletClickEvent) => {
        const { lat, lng } = e.latlng || ({} as LeafletLatLng);
        if (typeof lat === "number" && typeof lng === "number") {
          onPickLocationRef.current?.(lat, lng);
        }
      });
    }

    mapRef.current = map;
    setMapReady(true);

    const invalidate = () => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    };
    invalidate();
    const t0 = window.setTimeout(invalidate, 0);
    const t1 = window.setTimeout(invalidate, 100);
    const t2 = window.setTimeout(invalidate, 350);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(() => invalidate());
      ro.observe(containerRef.current);
    }

    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      try {
        ro?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      setMapReady(false);
    };
  }, [ready]);

  useEffect(() => {
    const L = (window as unknown as { L?: LeafletNamespace }).L;
    if (!L || !mapRef.current || !mapReady) return;

    for (const m of markersRef.current) {
      try {
        m.remove();
      } catch {
        /* ignore */
      }
    }
    markersRef.current = [];

    const valid = (Array.isArray(listings) ? listings : []).filter(
      (l) => (l.lat ?? l.latitude) !== undefined && (l.lng ?? l.longitude) !== undefined,
    );

    const icon = pinIcon(L);
    for (const l of valid) {
      const lat = Number(l.lat ?? l.latitude);
      const lng = Number(l.lng ?? l.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      if (l.title) marker.bindPopup(String(l.title));
      markersRef.current.push(marker);
    }

    if (markersRef.current.length > 0) {
      try {
        mapRef.current.invalidateSize();
        const group = L.featureGroup(markersRef.current);
        mapRef.current.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 10 });
      } catch {
        /* ignore */
      }
    }
  }, [listings, mapReady]);

  const infoText = useMemo(() => {
    const override = (listingsCountLabel || "").trim();
    if (override) return override;
    return Array.isArray(listings) ? `${listings.length} listings` : "Map";
  }, [listings, listingsCountLabel]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          ...(onPickLocation ? {} : { minHeight: 460 }),
          borderRadius: 8,
          border: "1px solid #d0d7de",
          overflow: "hidden",
          cursor: onPickLocation ? "crosshair" : "grab",
          background: "#eef2f7",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 400,
            background: "rgba(255,255,255,0.9)",
            color: "#111",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          {infoText}
        </div>
        {children}
      </div>
    </div>
  );
}
