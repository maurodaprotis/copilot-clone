import type { FxConvertResult, RateBook } from "./types.js";

function key(from: string, to: string, on_date: string): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}:${on_date}`;
}

/**
 * Convert amount between currencies using rate_book.
 * Order: same-currency → direct → invert → fallback (nearest earlier date) + warning.
 */
export function fx_convert(
  amount: number,
  from: string,
  to: string,
  on_date: string,
  rate_book: RateBook,
): FxConvertResult {
  const src = from.toUpperCase();
  const dst = to.toUpperCase();

  if (src === dst) {
    return {
      amount,
      from: src,
      to: dst,
      on_date,
      rate: 1,
      used_fallback: false,
    };
  }

  const directKey = key(src, dst, on_date);
  if (directKey in rate_book) {
    const rate = rate_book[directKey]!;
    return {
      amount: amount * rate,
      from: src,
      to: dst,
      on_date,
      rate,
      used_fallback: false,
    };
  }

  const invertKey = key(dst, src, on_date);
  if (invertKey in rate_book) {
    const inv = rate_book[invertKey]!;
    const rate = 1 / inv;
    return {
      amount: amount * rate,
      from: src,
      to: dst,
      on_date,
      rate,
      used_fallback: false,
    };
  }

  // Fallback: nearest earlier date for direct or invert pairs.
  const prefixDirect = `${src}:${dst}:`;
  const prefixInvert = `${dst}:${src}:`;
  let bestDate: string | null = null;
  let bestRate: number | null = null;
  let viaInvert = false;

  for (const [k, rate] of Object.entries(rate_book)) {
    if (k.startsWith(prefixDirect)) {
      const d = k.slice(prefixDirect.length);
      if (d <= on_date && (bestDate === null || d > bestDate)) {
        bestDate = d;
        bestRate = rate;
        viaInvert = false;
      }
    } else if (k.startsWith(prefixInvert)) {
      const d = k.slice(prefixInvert.length);
      if (d <= on_date && (bestDate === null || d > bestDate)) {
        bestDate = d;
        bestRate = 1 / rate;
        viaInvert = true;
      }
    }
  }

  if (bestRate !== null && bestDate !== null) {
    return {
      amount: amount * bestRate,
      from: src,
      to: dst,
      on_date,
      rate: bestRate,
      used_fallback: true,
      warning: `Used fallback FX rate from ${bestDate}${viaInvert ? " (inverted)" : ""} for ${src}->${dst} on ${on_date}`,
    };
  }

  return {
    amount,
    from: src,
    to: dst,
    on_date,
    rate: null,
    used_fallback: true,
    warning: `No FX rate found for ${src}->${dst} on or before ${on_date}; amount left unconverted`,
  };
}
