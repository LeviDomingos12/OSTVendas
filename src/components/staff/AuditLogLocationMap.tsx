import React, { useState, useEffect } from "react";
import { Activity, MapPin, Globe } from "lucide-react";
import { AuditLog } from "../../types";

interface AuditLogLocationMapProps {
  log: AuditLog;
}

export function AuditLogLocationMap({ log }: AuditLogLocationMapProps) {
  const [geo, setGeo] = useState<{
    city?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lon?: number;
    org?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawIp = log.ip || "";
    const ipMatch = rawIp.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    const ipAddress = ipMatch ? ipMatch[0] : "";

    let parsedCity = "Maputo";
    let parsedCountry = "Moçambique";
    let parsedCountryCode = "MZ";
    const parsedLat = -25.9692;
    const parsedLon = 32.5732;

    const parenMatch = rawIp.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const parts = parenMatch[1].split(",");
      if (parts[0]) parsedCity = parts[0].trim();
      if (parts[1]) {
        parsedCountry = parts[1].trim();
        const countryLower = parsedCountry.toLowerCase();
        if (
          countryLower.includes("mz") ||
          countryLower.includes("moçambique") ||
          countryLower.includes("mocambique")
        ) {
          parsedCountryCode = "MZ";
        } else {
          parsedCountryCode = parsedCountry.toUpperCase().slice(0, 2);
        }
      }
    }

    const isLocalOrSimulated =
      !ipAddress ||
      ipAddress === "127.0.0.1" ||
      ipAddress === "localhost" ||
      ipAddress.startsWith("192.168.") ||
      ipAddress.startsWith("10.");

    if (isLocalOrSimulated) {
      setGeo({
        city: parsedCity,
        country: parsedCountry,
        countryCode: parsedCountryCode,
        lat: parsedLat,
        lon: parsedLon,
        org: "Rede Local / VPN",
      });
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchGeo = async () => {
      try {
        const res = await fetch(`https://ip-api.com/json/${ipAddress}`);
        const data = await res.json();
        if (isMounted) {
          if (data && data.status === "success") {
            setGeo({
              city: data.city || parsedCity,
              country: data.country || parsedCountry,
              countryCode: data.countryCode || parsedCountryCode,
              lat: data.lat || parsedLat,
              lon: data.lon || parsedLon,
              org: data.org || "Provedor ISP Local",
            });
          } else {
            setGeo({
              city: parsedCity,
              country: parsedCountry,
              countryCode: parsedCountryCode,
              lat: parsedLat,
              lon: parsedLon,
              org: "Provedor IP Local",
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setGeo({
            city: parsedCity,
            country: parsedCountry,
            countryCode: parsedCountryCode,
            lat: parsedLat,
            lon: parsedLon,
            org: "Provedor Local",
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchGeo();
    return () => {
      isMounted = false;
    };
  }, [log.ip]);

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex items-center justify-center h-40 animate-pulse text-slate-400 text-xs gap-2 font-sans mt-3">
        <Activity className="w-4 h-4 animate-spin text-orange-500" />
        <span>A carregar mapa de geolocalização do IP...</span>
      </div>
    );
  }

  if (!geo) return null;

  const { city, country, countryCode, lat, lon, org } = geo;

  const isOutsideMozambique =
    countryCode !== "MZ" &&
    !country?.toLowerCase().includes("moçambique") &&
    !country?.toLowerCase().includes("mozambique");

  let isAfterHours = false;
  try {
    const d = new Date(log.timestamp);
    const hours = d.getHours();
    if (hours >= 22 || hours < 6) {
      isAfterHours = true;
    }
  } catch (e) {}

  let securityBadgeColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
  let securityText = "Conexão de local esperado e seguro (Moçambique).";
  let securityStatus = "✓ ACESSO REGULAR";

  if (isOutsideMozambique) {
    securityBadgeColor =
      "text-red-700 bg-red-50 border-red-200 animate-pulse ring-1 ring-red-300";
    securityText =
      "AVISO: Este acesso foi registado a partir de um IP fora de Moçambique. Recomenda-se validar as credenciais do utilizador.";
    securityStatus = "🚨 CRÍTICO: IP INTERNACIONAL SUSPEITO";
  } else if (isAfterHours) {
    securityBadgeColor = "text-amber-700 bg-amber-50 border-amber-200";
    securityText =
      "Alerta: Conexão registada fora de horas de serviço padrão (22:00h - 06:00h).";
    securityStatus = "⚠️ ATENÇÃO: ACESSO FORA DE HORAS";
  }

  const latVal = lat || -25.9692;
  const lonVal = lon || 32.5732;
  const delta = 0.015;
  const minLon = lonVal - delta;
  const minLat = latVal - delta;
  const maxLon = lonVal + delta;
  const maxLat = latVal + delta;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${latVal}%2C${lonVal}`;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 mt-3">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-orange-500" />
          <h4 className="font-extrabold text-slate-800 text-xs font-sans">
            Geolocalização & Segurança do IP
          </h4>
        </div>
        <span
          className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase font-sans ${securityBadgeColor}`}
        >
          {securityStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Geolocation Details column */}
        <div className="md:col-span-5 space-y-2.5 font-sans text-xs">
          <div className="bg-white border border-slate-100 p-3 rounded-xl space-y-2.5 shadow-sm">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 text-[9.5px] uppercase font-bold tracking-wider">
                Endereço IP
              </span>
              <span className="font-mono text-[10px] text-slate-800 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200 select-all">
                {log.ip?.split(" ")[0] || "102.81.12.94"}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 text-[9.5px] uppercase font-bold tracking-wider">
                Cidade
              </span>
              <span className="text-slate-700 font-bold">{city}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 text-[9.5px] uppercase font-bold tracking-wider">
                País
              </span>
              <span className="text-slate-700 font-bold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                {country} ({countryCode})
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 text-[9.5px] uppercase font-bold tracking-wider">
                Provedor ISP
              </span>
              <span className="text-slate-700 font-extrabold truncate max-w-[130px]">
                {org}
              </span>
            </div>
          </div>

          <div className="bg-white/80 border border-slate-100 p-2.5 rounded-xl text-[10.5px] text-slate-600 leading-normal font-medium shadow-sm">
            <span className="text-slate-400 text-[9px] uppercase font-black block tracking-wider mb-0.5">
              Parecer de Segurança
            </span>
            {securityText}
          </div>
        </div>

        {/* Static/Interactive Map Iframe Column */}
        <div className="md:col-span-7 h-44 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner bg-slate-100">
          <iframe
            src={embedUrl}
            className="w-full h-full border-none"
            scrolling="no"
            title={`Mapa do IP ${log.ip}`}
          />
          <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm border border-slate-200 px-2 py-0.5 rounded text-[8px] font-bold text-slate-500 pointer-events-none select-none font-mono shadow-sm">
            OpenStreetMap
          </div>
        </div>
      </div>
    </div>
  );
}
