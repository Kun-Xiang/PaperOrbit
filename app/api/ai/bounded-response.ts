export class ResponseBodyTooLargeError extends Error {
  readonly limitBytes: number;
  readonly receivedBytes: number;

  constructor(limitBytes: number, receivedBytes: number) {
    super(`Upstream response exceeded ${limitBytes} bytes`);
    this.name = "ResponseBodyTooLargeError";
    this.limitBytes = limitBytes;
    this.receivedBytes = receivedBytes;
  }
}

export type BoundedResponseText = {
  text: string;
  truncated: boolean;
};

function declaredContentLength(response: Response) {
  const raw = response.headers.get("content-length");
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function readBoundedResponseText(
  response: Response,
  limitBytes: number,
  options: { truncate?: boolean } = {},
): Promise<BoundedResponseText> {
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
    throw new TypeError("Response byte limit must be a positive safe integer");
  }
  if (!response.body) return { text: "", truncated: false };

  const truncate = options.truncate === true;
  const declared = declaredContentLength(response);
  if (declared !== null && declared > limitBytes && !truncate) {
    await response.body.cancel("response body too large").catch(() => undefined);
    throw new ResponseBodyTooLargeError(limitBytes, declared);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  let complete = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        text += decoder.decode();
        return { text, truncated: false };
      }
      if (!value?.byteLength) continue;

      const remaining = limitBytes - receivedBytes;
      if (value.byteLength > remaining) {
        if (!truncate) {
          throw new ResponseBodyTooLargeError(
            limitBytes,
            receivedBytes + value.byteLength,
          );
        }
        if (remaining > 0) {
          text += decoder.decode(value.subarray(0, remaining), { stream: true });
          receivedBytes += remaining;
        }
        text += decoder.decode();
        return { text, truncated: true };
      }

      receivedBytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (!complete) await reader.cancel("bounded response complete").catch(() => undefined);
    reader.releaseLock();
  }
}

export async function readBoundedResponseJson(
  response: Response,
  limitBytes: number,
): Promise<unknown> {
  const { text } = await readBoundedResponseText(response, limitBytes);
  return JSON.parse(text);
}
