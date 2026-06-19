"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import type { LiveRiskSnapshot, PublicReport } from "@/lib/types";
import { cityCoordinates } from "@/lib/live-risk";

type LiveRiskMapProps = {
  risks: LiveRiskSnapshot[];
  reports: PublicReport[];
  selectedReport?: PublicReport | null;
  onSelectReport: (report: PublicReport) => void;
};

export default function LiveRiskMap({ risks, reports, selectedReport, onSelectReport }: LiveRiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const riskByCity = useMemo(() => new Map(risks.map((risk) => [risk.city, risk])), [risks]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Leaflet stores an internal id on the DOM node. Clear stale ids from hot reloads.
    delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;

    const map = L.map(containerRef.current, {
      center: [26.1, 68.25],
      zoom: 7,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markerLayerRef.current = markerLayer;

    window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      markerLayer.clearLayers();
      map.remove();
      markerLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;

    markerLayer.clearLayers();

    cityCoordinates.forEach((location) => {
      const risk = riskByCity.get(location.city);
      L.marker([location.latitude, location.longitude], {
        icon: riskIcon(risk?.riskScore ?? 0)
      })
        .bindTooltip(`${location.city} ${risk ? `${risk.riskScore}%` : ""}`, {
          direction: "top",
          offset: [0, -10]
        })
        .bindPopup(cityPopup(location.city, risk))
        .addTo(markerLayer);
    });

    reports.forEach((report, index) => {
      const isSelected = selectedReport === report || selectedReport?.id === report.id;
      L.marker(getReportPosition(report, index), {
        icon: reportIcon(isSelected)
      })
        .on("click", () => onSelectReport(report))
        .bindPopup(reportPopup(report))
        .addTo(markerLayer);
    });
  }, [onSelectReport, reports, riskByCity, selectedReport]);

  return <div ref={containerRef} className="liveMap" />;
}

function cityPopup(city: string, risk?: LiveRiskSnapshot) {
  return `
    <div class="mapPopup">
      <strong>${escapeHtml(city)}</strong>
      <span>Risk: ${risk ? `${risk.riskScore}% ${risk.level}` : "Loading"}</span>
      <span>Forecast rain: ${risk ? `${risk.forecastRainMm.toFixed(1)} mm` : "-"}</span>
      <span>Rain probability: ${risk ? `${risk.precipitationProbability}%` : "-"}</span>
      <span>NASA rain: ${risk?.nasaRainMm === null || !risk ? "-" : `${risk.nasaRainMm.toFixed(1)} mm`}</span>
    </div>
  `;
}

function reportPopup(report: PublicReport) {
  return `
    <div class="mapPopup">
      <strong>${escapeHtml(report.type)}</strong>
      <span>${escapeHtml(report.city)} - ${escapeHtml(report.severity)}</span>
      <span>Status: ${escapeHtml(report.status)}</span>
      ${report.location ? `<span>${escapeHtml(report.location)}</span>` : ""}
    </div>
  `;
}

function getReportPosition(report: PublicReport, index: number): [number, number] {
  if (typeof report.latitude === "number" && typeof report.longitude === "number") {
    return [report.latitude, report.longitude];
  }

  const fallback = cityCoordinates.find((location) => location.city === report.city) ?? cityCoordinates[0];
  const offset = (index % 5) * 0.035;
  return [fallback.latitude + offset, fallback.longitude + offset];
}

function riskIcon(score: number) {
  const tone = score >= 81 ? "critical" : score >= 61 ? "high" : score >= 31 ? "moderate" : "low";
  return L.divIcon({
    className: `riskMapIcon ${tone}`,
    html: `<span>${score || "?"}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

function reportIcon(selected: boolean) {
  return L.divIcon({
    className: selected ? "reportMapIcon selected" : "reportMapIcon",
    html: "<span></span>",
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
