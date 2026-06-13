import { render } from "@testing-library/react";
import { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AppProvider } from "../context";
import "../i18n";
import i18n from "../i18n";

/** Render a component inside the app's Router + AppProvider. */
export function renderApp(ui: ReactElement, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProvider>{ui}</AppProvider>
    </MemoryRouter>,
  );
}

export async function setLang(lng: "zh" | "en") {
  await i18n.changeLanguage(lng);
}

type Handler = (url: string, init: RequestInit) => unknown;

/**
 * Install a fetch mock. `routes` maps a substring (matched against the request
 * URL, optionally prefixed with "METHOD ") to either a value (returned as JSON)
 * or a handler. Unmatched routes reject with a 404-style ApiError response.
 */
export function mockFetch(routes: Record<string, unknown | Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = (init.method ?? "GET").toUpperCase();
    for (const [key, val] of Object.entries(routes)) {
      const [maybeMethod, ...rest] = key.split(" ");
      const hasMethod = ["GET", "POST", "PUT", "DELETE"].includes(maybeMethod);
      const pattern = hasMethod ? rest.join(" ") : key;
      if (hasMethod && maybeMethod !== method) continue;
      if (url.includes(pattern)) {
        const data = typeof val === "function" ? (val as Handler)(url, init) : val;
        if (data instanceof Error) {
          return {
            ok: false,
            status: 400,
            statusText: "Bad Request",
            json: async () => ({ detail: data.message }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => data,
        } as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "not found" }),
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
