/**
 * Mock de HTTP para Jest + CRA (evita MSW 2 + ESM/static class blocks en react-scripts).
 * Cumple el mismo objetivo pedagógico: interceptar peticiones y devolver JSON controlado.
 */

/** @param {unknown} data */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @param {Array<{
 *   test: (url: string, init?: RequestInit) => boolean;
 *   handle: (url: string, init?: RequestInit) => Response | Promise<Response>;
 * }>} routes
 * @returns {jest.Mock}
 */
export function setupFetchMock(routes) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const route = routes.find((r) => r.test(url, init || {}));
    if (!route) {
      return Promise.reject(new Error(`Unmocked fetch: ${(init && init.method) || 'GET'} ${url}`));
    }
    return Promise.resolve(route.handle(url, init || {}));
  });
}

export function pathIncludes(url, fragment) {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return pathname.includes(fragment) || String(url).includes(fragment);
  } catch {
    return String(url).includes(fragment);
  }
}
