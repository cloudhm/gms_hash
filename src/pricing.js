function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function eligibleSubtotal(lineItems, productId) {
  let sum = 0;
  for (const line of lineItems || []) {
    if (line.product_id === productId) continue;
    const amt = line.final_line_price ?? line.line_price ?? 0;
    sum += money(amt);
  }
  return Math.round(sum * 100) / 100;
}

export function pickVariant({ subtotal, rate, maxCovered, variants }) {
  if (!(subtotal > 0) || !variants?.length) return null;
  const covered = Math.min(subtotal, maxCovered);
  const raw = covered * rate;
  const cap = maxCovered * rate;
  const eligible = variants
    .map((v) => ({ ...v, price: money(v.price) }))
    .filter((v) => v.price <= cap)
    .sort((a, b) => a.price - b.price);
  if (!eligible.length) return null;
  const variant = eligible.find((v) => v.price >= raw) || eligible[eligible.length - 1];
  return { variant, raw, cap, covered };
}
