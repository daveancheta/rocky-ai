export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response

  try {
    response = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }
    throw new ApiError("Unable to reach ROCKY right now. Please try again.", 0)
  }

  const responseText = await response.text()
  let body: unknown
  if (responseText) {
    try {
      body = JSON.parse(responseText)
    } catch {
      if (response.ok) {
        throw new ApiError("The server returned an invalid response.", response.status)
      }
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The request could not be completed."
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  if (!responseText) {
    throw new ApiError("The server returned an empty response.", response.status)
  }

  return body as T
}
