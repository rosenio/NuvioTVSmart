/**
 * NuvioService mDNS Discovery for Tizen
 * Discovers NuvioService instances on LAN via _nuvio._tcp mDNS service
 */

import { Platform } from "../../platform/index.js";

const NUVIO_MDNS_TYPE = "_nuvio._tcp";

function parseTxtRecord(txtRecord) {
  const result = {};
  if (!txtRecord) return result;
  try {
    for (const entry of txtRecord) {
      const [key, value] = entry.split("=");
      if (key) result[key] = value || true;
    }
  } catch (_) {}
  return result;
}

export async function discoverNuvioService({ timeoutMs = 5000 } = {}) {
  if (!Platform.isTizen()) {
    return [];
  }

  try {
    const tizen = window.tizen;
    if (!tizen?.networkservice?.findServices) {
      console.warn("Tizen NetworkService API not available");
      return [];
    }

    return await new Promise((resolve) => {
      const discovered = [];
      const timeoutId = setTimeout(() => {
        resolve(discovered);
      }, timeoutMs);

      try {
        tizen.networkservice.findServices(
          {
            type: NUVIO_MDNS_TYPE,
          },
          {
            onsuccess: (services) => {
              clearTimeout(timeoutId);
              for (const service of services || []) {
                try {
                  const ip = service.ipaddress || service.ipv4 || "";
                  const port = service.port || 0;
                  const name = service.name || "";
                  const txt = parseTxtRecord(service.txtRecord || []);
                  if (ip && port) {
                    discovered.push({
                      name,
                      address: ip,
                      port,
                      streamingPort: txt.streaming ? txt.streaming_port || "11470" : "11470",
                      apiVersion: txt.api || "1.0",
                      streaming: txt.streaming === "true" || txt.streaming === true,
                      type: "nuvio-service",
                    });
                  }
                } catch (_) {}
              }
              resolve(discovered);
            },
            onerror: (error) => {
              clearTimeout(timeoutId);
              console.warn("Tizen mDNS discovery error:", error?.message || error);
              resolve([]);
            },
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        console.warn("Tizen mDNS discovery failed:", error?.message || error);
        resolve([]);
      }
    });
  } catch (error) {
    console.warn("NuvioService mDNS discovery failed:", error?.message || error);
    return [];
  }
}

export function canDiscoverNuvioService() {
  if (!Platform.isTizen()) return false;
  try {
    const tizen = window.tizen;
    return Boolean(tizen?.networkservice?.findServices);
  } catch {
    return false;
  }
}