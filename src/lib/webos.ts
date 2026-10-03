const WEBOS_PROXY_SERVICE = "luna://com.nextup.app.tv.proxy";

export type WebOSServiceResponse = {
  returnValue?: boolean;
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: string;
  errorText?: string;
  errorCode?: number;
  fileName?: string;
  [key: string]: unknown;
};

type WebOSServiceRequest = {
  cancel?: () => void;
};

declare global {
  interface Window {
    webOS?: {
      platform?: { tv?: boolean };
      platformBack?: () => void;
      service?: {
        request: (
          uri: string,
          options: {
            method: string;
            parameters?: Record<string, unknown>;
            onSuccess?: (response: WebOSServiceResponse) => void;
            onFailure?: (response: WebOSServiceResponse) => void;
          }
        ) => WebOSServiceRequest;
      };
    };
    PalmSystem?: {
      platformBack?: () => void;
      launchParams?: string;
    };
  }
}

export function requestWebOSService(
  method: string,
  parameters: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<WebOSServiceResponse> {
  return new Promise((resolve, reject) => {
    if (!window.webOS?.service?.request) {
      reject(new Error("The NextUp webOS service is unavailable."));
      return;
    }

    let settled = false;
    let request: WebOSServiceRequest | undefined;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", onAbort);
      callback();
    };

    const onAbort = () => {
      request?.cancel?.();
      finish(() => reject(new DOMException("Aborted", "AbortError")));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    if (signal) signal.addEventListener("abort", onAbort, { once: true });

    request = window.webOS.service.request(WEBOS_PROXY_SERVICE, {
      method,
      parameters,
      onSuccess: payload => finish(() => resolve(payload)),
      onFailure: payload => finish(() => reject(new Error(payload.errorText || "The TV service request failed.")))
    });
  });
}

export function isWebOSTV(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return window.webOS?.platform?.tv === true || /Web0S|webOS\.TV/i.test(navigator.userAgent);
}

export function isTvBackKey(event: KeyboardEvent): boolean {
  return event.keyCode === 461 || event.which === 461 || event.key === "GoBack" || event.key === "BrowserBack";
}

export function platformBack(): void {
  if (typeof window === "undefined") return;

  if (typeof window.webOS?.platformBack === "function") {
    window.webOS.platformBack();
    return;
  }

  if (typeof window.PalmSystem?.platformBack === "function") {
    window.PalmSystem.platformBack();
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

function requestThroughWebOSService(targetUrl: string, signal?: AbortSignal): Promise<Response> {
  return requestWebOSService("fetchJson", { url: targetUrl }, signal).then(payload => {
    const status = typeof payload.status === "number" ? payload.status : payload.ok === false ? 502 : 200;
    return new Response(typeof payload.body === "string" ? payload.body : "", {
      status,
      statusText: payload.statusText || ""
    });
  });
}

export function fetchThroughProxy(targetUrl: string, signal?: AbortSignal): Promise<Response> {
  if (isWebOSTV()) {
    return requestThroughWebOSService(targetUrl, signal);
  }

  const fetchDirect = () => fetch(targetUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    signal
  });

  // GitHub Pages and other static hosts cannot serve the Express proxy route.
  // AIOStreams/Stremio endpoints normally expose CORS, so go directly there
  // instead of accepting the static host's HTML 404 response as stream data.
  if (
    typeof window !== "undefined" &&
    window.location &&
    (window.location.protocol === "file:" || window.location.hostname.endsWith("github.io"))
  ) {
    return fetchDirect();
  }

  const proxyUrl = `/api/debrid/stream?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxyUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  }).then(response => {
    const contentType = response.headers?.get?.("content-type") || "";
    const proxyIsUnavailable = response.status === 403 || response.status === 404 ||
      response.status === 405 || response.status === 503;
    const proxyReturnedTheAppShell = response.ok && contentType.includes("text/html");

    return proxyIsUnavailable || proxyReturnedTheAppShell
      ? fetchDirect()
      : response;
  }).catch(error => {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return fetchDirect();
  });
}
