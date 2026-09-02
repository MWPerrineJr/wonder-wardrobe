const REQUEST_ID_HEADER = "x-request-id";

export function readRequestId(request: Request): string {
  return (
    request.headers.get(REQUEST_ID_HEADER) ?? request.headers.get("cf-ray") ?? crypto.randomUUID()
  );
}

export function requestWithId(request: Request, requestId: string): Request {
  if (request.headers.get(REQUEST_ID_HEADER) === requestId) return request;
  // Vite's incoming Request is a different undici class than `new Request(request)`.
  // Mutate headers in place when the host allows it.
  try {
    request.headers.set(REQUEST_ID_HEADER, requestId);
    return request;
  } catch {
    const headers = new Headers();
    request.headers.forEach((value, key) => headers.append(key, value));
    headers.set(REQUEST_ID_HEADER, requestId);
    return new Request(request.url, { method: request.method, headers });
  }
}

export function applyRequestIdHeader(response: Response, requestId: string): Response {
  if (response.headers.has(REQUEST_ID_HEADER)) return response;
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
