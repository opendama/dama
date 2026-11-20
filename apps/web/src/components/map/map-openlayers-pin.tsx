"use client";

/**
 * Pin-picker OpenLayers map - mirrors smart-menu `map-openlayers.tsx` location-pick path:
 * OSM tiles, world view zoom 2, click → onPickLocation + animate zoom 12, vector pin marker.
 * Listing clusters/mini-cards omitted (ads campaign pin only).
 */

import type React from "react";
import { useEffect, useRef } from "react";
import "ol/ol.css";
import type { MapListing } from "./map-leaflet";

const PIN_ZOOM = 12;
const WORLD_ZOOM = 2;

export default function MapOpenLayersPin({
  listings = [],
  onPickLocation,
  children,
}: {
  listings?: MapListing[];
  onPickLocation?: (lat: number, lng: number) => void;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{
    getView: () => {
      setCenter: (c: unknown) => void;
      setZoom: (z: number) => void;
      animate: (opts: unknown) => void;
    };
    on: (event: string, handler: unknown) => void;
    un: (event: string, handler: unknown) => void;
    setTarget: (t?: unknown) => void;
    addLayer: (layer: unknown) => void;
  } | null>(null);
  const vectorSourceRef = useRef<{
    clear: () => void;
    addFeature: (f: unknown) => void;
  } | null>(null);
  const onPickLocationRef = useRef(onPickLocation);
  const listingsRef = useRef(listings);
  const clickHandlerRef = useRef<unknown>(null);

  useEffect(() => {
    onPickLocationRef.current = onPickLocation;
  }, [onPickLocation]);

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const [
        { fromLonLat, toLonLat },
        MapClass,
        View,
        TileLayer,
        OSM,
        VectorSource,
        VectorLayer,
        Feature,
        Point,
        Style,
        CircleStyle,
        Fill,
        Stroke,
      ] = await Promise.all([
        import("ol/proj"),
        import("ol/Map").then((m) => m.default),
        import("ol/View").then((m) => m.default),
        import("ol/layer/Tile").then((m) => m.default),
        import("ol/source/OSM").then((m) => m.default),
        import("ol/source/Vector").then((m) => m.default),
        import("ol/layer/Vector").then((m) => m.default),
        import("ol/Feature").then((m) => m.default),
        import("ol/geom/Point").then((m) => m.default),
        import("ol/style/Style").then((m) => m.default),
        import("ol/style/Circle").then((m) => m.default),
        import("ol/style/Fill").then((m) => m.default),
        import("ol/style/Stroke").then((m) => m.default),
      ]);
      if (cancelled || !containerRef.current) return;

      const vectorSource = new VectorSource();
      vectorSourceRef.current = vectorSource as unknown as {
        clear: () => void;
        addFeature: (f: unknown) => void;
      };

      const pinStyle = new Style({
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: "#16a34a" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      });

      const map = new MapClass({
        target: containerRef.current,
        layers: [
          new TileLayer({ source: new OSM() }),
          new VectorLayer({
            source: vectorSource,
            style: pinStyle,
          }),
        ],
        view: new View({
          center: fromLonLat([0, 0]),
          zoom: WORLD_ZOOM,
          projection: "EPSG:3857",
        }),
      });

      const zoomTo = (lat: number, lng: number) => {
        const center = fromLonLat([lng, lat]);
        const view = map.getView();
        view.setCenter(center);
        view.setZoom(PIN_ZOOM);
        view.animate({ center, zoom: PIN_ZOOM, duration: 1000 });
      };

      const clickHandler = (event: { coordinate: number[] }) => {
        const [lng, lat] = toLonLat(event.coordinate);
        if (typeof lat !== "number" || typeof lng !== "number") return;
        onPickLocationRef.current?.(lat, lng);
        zoomTo(lat, lng);
      };

      if (onPickLocationRef.current) {
        map.on("click", clickHandler);
        clickHandlerRef.current = clickHandler;
      }

      mapRef.current = map as unknown as typeof mapRef.current;

      // Seed marker if parent already has a pin (listings via ref - mount once).
      const first = (listingsRef.current || []).find(
        (l) =>
          (typeof l.lat === "number" && typeof l.lng === "number") ||
          (typeof l.latitude === "number" && typeof l.longitude === "number"),
      );
      if (first) {
        const lat = Number(first.lat ?? first.latitude);
        const lng = Number(first.lng ?? first.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          vectorSource.clear();
          vectorSource.addFeature(new Feature({ geometry: new Point(fromLonLat([lng, lat])) }));
          zoomTo(lat, lng);
        }
      }
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map && clickHandlerRef.current) {
        try {
          map.un("click", clickHandlerRef.current);
        } catch {
          /* ignore */
        }
      }
      if (map) {
        try {
          map.setTarget(undefined);
        } catch {
          /* ignore */
        }
      }
      mapRef.current = null;
      vectorSourceRef.current = null;
      clickHandlerRef.current = null;
    };
    // Intentionally once on mount - pin updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = vectorSourceRef.current;
    const map = mapRef.current;
    if (!source || !map) return;

    (async () => {
      const { fromLonLat } = await import("ol/proj");
      const Feature = (await import("ol/Feature")).default;
      const Point = (await import("ol/geom/Point")).default;
      source.clear();
      const valid = (listings || []).filter(
        (l) =>
          (typeof l.lat === "number" && typeof l.lng === "number") ||
          (typeof l.latitude === "number" && typeof l.longitude === "number"),
      );
      for (const l of valid) {
        const lat = Number(l.lat ?? l.latitude);
        const lng = Number(l.lng ?? l.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        source.addFeature(new Feature({ geometry: new Point(fromLonLat([lng, lat])) }));
      }
      const only = valid.length === 1 ? valid[0] : undefined;
      if (only) {
        const lat = Number(only.lat ?? only.latitude);
        const lng = Number(only.lng ?? only.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const center = fromLonLat([lng, lat]);
          const view = map.getView();
          view.setCenter(center);
          view.setZoom(PIN_ZOOM);
        }
      }
    })();
  }, [listings]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: 460,
          borderRadius: 8,
          border: "1px solid var(--dama-border, #d0d7de)",
          overflow: "hidden",
          cursor: onPickLocation ? "crosshair" : "grab",
          background: "#eef2f7",
        }}
      >
        {children}
      </div>
    </div>
  );
}
