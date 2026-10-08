// COPEAK_DELIVERY_SAFETY_V1
export const DELIVERY_LIMIT = 7000;

export function reviewDeliveryUrl(input, reserve = 0) {
  const url = new URL(String(input));
  const extra = Number.isFinite(reserve) ? Math.max(0, reserve) : 0;
  const full = url.toString().length + extra;

  const shortened = new URL(url.toString());
  shortened.searchParams.delete('jpn');
  const noJapanese = shortened.toString().length + extra;

  const omitJapanese =
    Boolean(url.searchParams.get('jpn')) && full > DELIVERY_LIMIT;

  const effective = omitJapanese ? noJapanese : full;

  return {
    full,
    effective,
    omitJapanese,
    tooLong: effective > DELIVERY_LIMIT,
    warning: effective >= 4000
  };
}
