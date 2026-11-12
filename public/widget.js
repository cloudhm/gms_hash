(function () {
  'use strict';

  function money(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function eligibleSubtotal(lineItems, productId) {
    let sum = 0;
    for (const line of lineItems || []) {
      if (line.product_id === productId) continue;
      const amt = line.final_line_price ?? line.line_price ?? 0;
      sum += money(amt);
    }
    return Math.round(sum * 100) / 100;
  }

  function pickVariant({ subtotal, rate, maxCovered, variants }) {
    if (!(subtotal > 0) || !variants?.length) return null;
    const covered = Math.min(subtotal, maxCovered);
    const raw = Math.round(covered * rate * 100) / 100;
    const cap = Math.round(maxCovered * rate * 100) / 100;
    const eligible = variants
      .map((v) => ({ ...v, price: money(v.price) }))
      .filter((v) => v.price <= cap)
      .sort((a, b) => a.price - b.price);
    if (!eligible.length) return null;
    const variant = eligible.find((v) => v.price >= raw) || eligible[eligible.length - 1];
    return { variant, raw, cap, covered };
  }

  function normalizeCart(json) {
    const cart = json?.data?.cart ?? json?.cart ?? json;
    const line_items = cart?.line_items ?? json?.line_items ?? [];
    return { line_items: Array.isArray(line_items) ? line_items : [] };
  }

  function formatPrice(amount) {
    return '$' + money(amount).toFixed(2);
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findCheckoutEl() {
    const selectors =
      'form[action*="checkout"] button, a[href*="checkout"], button[name="checkout"], [name="checkout"]';
    const nodes = document.querySelectorAll(selectors);
    for (const el of nodes) {
      if (isVisible(el)) return el;
    }
    return null;
  }

  function cartRoot() {
    return (window.SHOPLAZZA && window.SHOPLAZZA.routes && window.SHOPLAZZA.routes.root) || '';
  }

  const OPT_KEY = 'sss.optIn';

  function getOptIn() {
    const stored = sessionStorage.getItem(OPT_KEY);
    if (stored === null) return true;
    return stored === '1' || stored === 'true';
  }

  function setOptIn(value) {
    sessionStorage.setItem(OPT_KEY, value ? '1' : '0');
  }

  let cfg = null;
  let checkoutEl = null;
  let widgetEl = null;
  let withoutLink = null;
  let checkboxEl = null;
  let priceEl = null;
  let errorEl = null;
  let syncQueue = Promise.resolve();
  let syncInFlight = null;
  let mounted = false;

  async function fetchCart() {
    const root = cartRoot();
    const res = await fetch(root + '/api/cart', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('cart fetch');
    return normalizeCart(await res.json());
  }

  async function removeLine(variantId) {
    const root = cartRoot();
    const del = await fetch(root + '/api/cart/' + encodeURIComponent(variantId), {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (del.ok) return;
    const patch = await fetch(root + '/api/cart/' + encodeURIComponent(variantId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ quantity: 0 }),
    });
    if (!patch.ok) throw new Error('remove line');
  }

  async function addProtectionLine(variantId) {
    const root = cartRoot();
    const res = await fetch(root + '/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        product_id: cfg.productId,
        variant_id: variantId,
        quantity: 1,
        refer_info: { source: 'cart' },
        properties: { _sss: '1' },
      }),
    });
    if (!res.ok) throw new Error('add protection');
  }

  async function ensureProtection(cart, want) {
    const items = cart.line_items;
    const sub = eligibleSubtotal(items, cfg.productId);
    const picked = pickVariant({
      subtotal: sub,
      rate: cfg.rate,
      maxCovered: cfg.maxCovered,
      variants: cfg.variants,
    });
    const protectLines = items.filter((i) => i.product_id === cfg.productId);

    if (want && picked) {
      const lines = protectLines.filter((l) => (l.quantity ?? 1) > 0);
      if (
        lines.length === 1 &&
        String(lines[0].variant_id) === String(picked.variant.id) &&
        (lines[0].quantity ?? 1) === 1 &&
        protectLines.length === lines.length
      ) {
        return { picked, ok: true };
      }
      for (const line of protectLines) {
        const vid = line.variant_id;
        if (vid != null) await removeLine(vid);
      }
      await addProtectionLine(picked.variant.id);
      return { picked, ok: true };
    }

    if (!want || !picked) {
      for (const line of protectLines) {
        const vid = line.variant_id;
        if (vid != null) await removeLine(vid);
      }
    }
    return { picked: want ? picked : null, ok: true };
  }

  function injectStyles() {
    if (document.getElementById('sss-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'sss-widget-styles';
    style.textContent = `
.sss-widget {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: inherit;
  background: #fafafa;
}
.sss-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.sss-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin: 0;
}
.sss-checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.sss-price {
  color: #333;
}
.sss-error {
  margin-top: 8px;
  color: #b00020;
  font-size: 13px;
}
.sss-without {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  text-align: center;
  color: #666;
}
.sss-without:hover {
  color: #333;
}
`;
    document.head.appendChild(style);
  }

  function updateCheckoutLabel(optIn) {
    if (!checkoutEl) return;
    if (!checkoutEl.dataset.sssOriginalText) {
      checkoutEl.dataset.sssOriginalText = (checkoutEl.textContent || '').trim();
    }
    if (optIn) {
      checkoutEl.textContent = 'Checkout with Shipping Secure Service';
    } else {
      checkoutEl.textContent = checkoutEl.dataset.sssOriginalText;
    }
  }

  function setErrorVisible(show) {
    if (!errorEl) return;
    errorEl.hidden = !show;
  }

  function updatePriceDisplay(picked) {
    if (!priceEl) return;
    if (picked?.variant) {
      priceEl.textContent = formatPrice(picked.variant.price);
      priceEl.style.display = '';
    } else {
      priceEl.textContent = '';
      priceEl.style.display = 'none';
    }
  }

  async function render() {
    if (!mounted) return;
    let cart;
    try {
      cart = await fetchCart();
    } catch {
      return;
    }
    const sub = eligibleSubtotal(cart.line_items, cfg.productId);
    const picked = pickVariant({
      subtotal: sub,
      rate: cfg.rate,
      maxCovered: cfg.maxCovered,
      variants: cfg.variants,
    });
    const optIn = getOptIn();
    if (checkboxEl) checkboxEl.checked = optIn;
    updatePriceDisplay(picked);
    updateCheckoutLabel(optIn);
    return { cart, picked, optIn };
  }

  async function syncCart(wantProtection) {
    if (!cfg) return;
    const run = async () => {
      setErrorVisible(false);
      try {
        const cart = await fetchCart();
        await ensureProtection(cart, wantProtection);
        await render();
      } catch {
        if (wantProtection) setErrorVisible(true);
        throw new Error('sync failed');
      }
    };
    const next = syncQueue.then(run, run);
    syncInFlight = next.catch(() => {});
    syncQueue = syncInFlight;
    return next;
  }

  function navigateCheckout() {
    const root = cartRoot();
    if (checkoutEl.tagName === 'A' && checkoutEl.href) {
      window.location.href = checkoutEl.href;
      return;
    }
    const form = checkoutEl.closest('form');
    if (form) {
      const isSubmitter =
        checkoutEl.tagName === 'BUTTON' ||
        checkoutEl.tagName === 'INPUT' ||
        checkoutEl.getAttribute('type') === 'submit' ||
        checkoutEl.name === 'checkout';
      if (isSubmitter && typeof form.requestSubmit === 'function') {
        try {
          form.requestSubmit(checkoutEl);
          return;
        } catch {
          /* fall through */
        }
      }
      if (typeof checkoutEl.click === 'function') {
        checkoutEl.click();
        return;
      }
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return;
      }
      form.submit();
      return;
    }
    window.location.href = root + '/checkout';
  }

  async function goCheckout(options) {
    const withProtection = options && options.withProtection === true;
    const want = !!withProtection;
    if (syncInFlight) {
      await syncInFlight;
    }
    try {
      await syncCart(want);
    } catch {
      if (want) return;
    }
    navigateCheckout();
  }

  function onCartEvent() {
    (async () => {
      const info = await render();
      if (!info) return;
      try {
        await syncCart(info.optIn);
      } catch {
        /* display error via syncCart */
      }
    })();
  }

  function mount(checkout) {
    checkoutEl = checkout;
    if (!checkoutEl.dataset.sssOriginalText) {
      checkoutEl.dataset.sssOriginalText = (checkoutEl.textContent || '').trim();
    }

    injectStyles();

    widgetEl = document.createElement('div');
    widgetEl.id = 'sss-widget';
    widgetEl.className = 'sss-widget';
    widgetEl.innerHTML =
      '<div class="sss-title">Shipping Secure Service</div>' +
      '<label class="sss-row">' +
      '<input type="checkbox" class="sss-checkbox" checked />' +
      '<span class="sss-price"></span>' +
      '</label>' +
      '<div class="sss-error" hidden>Unable to add protection.</div>';

    withoutLink = document.createElement('a');
    withoutLink.href = '#';
    withoutLink.className = 'sss-without';
    withoutLink.textContent = 'Checkout without protection';

    checkboxEl = widgetEl.querySelector('.sss-checkbox');
    priceEl = widgetEl.querySelector('.sss-price');
    errorEl = widgetEl.querySelector('.sss-error');

    const parent = checkoutEl.parentNode;
    parent.insertBefore(widgetEl, checkoutEl);
    if (checkoutEl.nextSibling) {
      parent.insertBefore(withoutLink, checkoutEl.nextSibling);
    } else {
      parent.appendChild(withoutLink);
    }

    const initialOptIn = getOptIn();
    checkboxEl.checked = initialOptIn;
    setOptIn(initialOptIn);

    checkboxEl.addEventListener('change', () => {
      const on = checkboxEl.checked;
      setOptIn(on);
      updateCheckoutLabel(on);
      setErrorVisible(false);
      syncCart(on).catch(() => {});
    });

    checkoutEl.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        goCheckout({ withProtection: getOptIn() });
      },
      true,
    );

    withoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      goCheckout({ withProtection: false });
    });

    document.addEventListener('dj.cartChange', onCartEvent);
    document.addEventListener('dj.addToCart', onCartEvent);

    mounted = true;
    render().then(() => {
      if (getOptIn()) {
        syncCart(true).catch(() => {});
      }
    });
  }

  window.syncCart = syncCart;
  window.goCheckout = goCheckout;

  (async function bootstrap() {
    const src = document.currentScript && document.currentScript.src;
    const base = src ? src.replace(/\/widget\.js.*$/, '') : '';
    try {
      const res = await fetch(base + '/widget/config');
      if (!res.ok) throw new Error('config');
      cfg = await res.json();
    } catch {
      return;
    }

    const checkout = findCheckoutEl();
    if (!checkout) return;

    mount(checkout);
  })();
})();
