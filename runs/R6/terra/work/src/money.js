// Cap totals at £10 billion so pound values round-trip through Number without
// losing a penny and percentage rounding remains reliable.
const MAX_PENCE = 1_000_000_000_000;

// Convert a pound amount to integer pence, rejecting invalid or fractional pennies.
export function toPence(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new RangeError('Amount must be a finite, non-negative number');
  }
  const pence = amount * 100;
  const rounded = Math.round(pence);
  // Allow only floating-point representation noise, not fractions of a penny.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(pence)) * 4;
  if (!Number.isSafeInteger(rounded) || rounded > MAX_PENCE || Math.abs(pence - rounded) > tolerance) {
    throw new RangeError('Amount must be a safe number of whole pence');
  }
  return rounded;
}

export function checkedPence(pence) {
  if (!Number.isSafeInteger(pence) || pence < 0 || pence > MAX_PENCE) {
    throw new RangeError('Total exceeds the safe monetary range');
  }
  return pence;
}
