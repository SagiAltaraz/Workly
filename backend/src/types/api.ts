// Every response, expected or not, has this shape.
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
