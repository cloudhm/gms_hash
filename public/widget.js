(function () {
  'use strict';

  function money(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function eligibleSubtotal(lineItems, productId) {
    let sum = 0;
    for (const line of lineItems || []) {
      if (cfg && isProtectionLine(line)) continue;
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
    const cart = json?.data?.cart ?? json?.cart ?? json?.data ?? json;
    const line_items =
      cart?.line_items ?? json?.line_items ?? json?.data?.items ?? cart?.items ?? [];
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

  function looksLikeCheckout(el) {
    if (!el || el.closest('#sss-widget, .sss-without')) return false;
    if (el.matches('[role="checkout"], [name="checkout"], button[name="checkout"]')) return true;
    const href = (el.getAttribute('href') || el.getAttribute('action') || '').toLowerCase();
    if (href.includes('checkout')) return true;
    const track = (el.getAttribute('data-track-source') || '').toLowerCase();
    if (track === 'checkout' || track === 'check_out') return true;
    const text = (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    return /checkout|check out|结账|结算/i.test(text);
  }

  function findCheckoutEl() {
    const selectors = [
      '[role="checkout"]',
      'spz-checkout button',
      'spz-checkout [role="checkout"]',
      'form[action*="checkout"] button',
      'form[action*="checkout"] [type="submit"]',
      'a[href*="checkout"]',
      'button[name="checkout"]',
      '[name="checkout"]',
      'button[data-track-source="checkout"]',
      '#cart-summary-render button',
      '[id*="cart-summary"] button',
      'button[type="button"]',
      'button',
    ].join(',');
    const nodes = document.querySelectorAll(selectors);
    const scored = [];
    for (const el of nodes) {
      if (!isVisible(el) || !looksLikeCheckout(el)) continue;
      const inSummary = el.closest('#cart-summary-render, [id*="cart-summary"], spz-checkout, .cart-footer, [class*="cart-summary"]');
      scored.push({ el, score: inSummary ? 2 : 1 });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored[0] ? scored[0].el : null;
  }

  function waitForCartItems(timeoutMs) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = async () => {
        let cart = { line_items: [] };
        try {
          cart = await fetchCart();
        } catch {
          /* keep polling */
        }
        const hasApiItems = (cart.line_items || []).length > 0;
        const hasDomItems = !!document.querySelector(
          'spz-cart [class*="item"], spz-cart tr, [class*="cart-item"], [class*="CartItem"]',
        );
        if (hasApiItems || hasDomItems || Date.now() - started >= timeoutMs) {
          resolve(cart);
          return;
        }
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  function waitForCheckout(timeoutMs) {
    return new Promise((resolve) => {
      const existing = findCheckoutEl();
      if (existing) {
        resolve(existing);
        return;
      }
      const obs = new MutationObserver(() => {
        const el = findCheckoutEl();
        if (el) {
          obs.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        obs.disconnect();
        resolve(findCheckoutEl());
      }, timeoutMs);
    });
  }

  function fallbackAnchor() {
    return (
      document.querySelector('#cart-summary-render, spz-checkout, [id*="cart-summary"], .cart-footer, main, #cart') ||
      document.body
    );
  }

  function cartRoot() {
    return (window.SHOPLAZZA && window.SHOPLAZZA.routes && window.SHOPLAZZA.routes.root) || '';
  }

  let cfg = null;
  let checkoutEl = null;
  let widgetEl = null;
  let withoutLink = null;
  let priceEl = null;
  let errorEl = null;
  let syncQueue = Promise.resolve();
  let syncInFlight = null;
  let mounted = false;
  let lastSubtotal = 0;
  let lastPicked = null;
  let passThroughCheckout = false;

  function getCsrfToken() {
    const entry = document.cookie.split('; ').find((item) => item.startsWith('CSRF-TOKEN='));
    return entry ? decodeURIComponent(entry.slice('CSRF-TOKEN='.length)) : '';
  }

  function cartHeaders(mutating) {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (mutating) headers['X-CSRF-Token'] = getCsrfToken();
    return headers;
  }

  async function readCartError(res) {
    let detail = 'HTTP ' + res.status;
    try {
      const body = await res.json();
      const msg = body.message || body.msg || body.error || (body.errors && body.errors[0]);
      if (msg) detail = String(msg);
    } catch {
      /* ignore */
    }
    return detail;
  }

  async function fetchCart() {
    const root = cartRoot();
    const res = await fetch(root + '/api/cart', {
      credentials: 'same-origin',
      headers: cartHeaders(),
    });
    if (!res.ok) throw new Error(await readCartError(res));
    return normalizeCart(await res.json());
  }

  function isProtectionLine(line) {
    if (!line || !cfg) return false;
    if (line.product_id && String(line.product_id) === String(cfg.productId)) return true;
    const handle = line.product_handle || line.handle;
    if (cfg.handle && handle && String(handle) === String(cfg.handle)) return true;
    const vid = line.variant_id && String(line.variant_id);
    if (vid && (cfg.variants || []).some((v) => String(v.id) === vid)) return true;
    const title = String(line.product_title || line.title || '');
    if (/shipping\s*(secure|protection)|secure service/i.test(title)) return true;
    return false;
  }

  async function removeLine(line) {
    const variantId = line.variant_id || line.variantId;
    const lineId = line.id || line.item_id;
    const root = cartRoot();
    const attempts = [];
    if (variantId) {
      attempts.push(() =>
        fetch(root + '/api/cart/' + encodeURIComponent(variantId), {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: cartHeaders(true),
        }),
      );
    }
    if (lineId && lineId !== variantId) {
      attempts.push(() =>
        fetch(root + '/api/cart/' + encodeURIComponent(lineId), {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: cartHeaders(true),
        }),
      );
    }
    if (variantId) {
      attempts.push(() =>
        fetch(root + '/api/cart/' + encodeURIComponent(variantId), {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: cartHeaders(true),
          body: JSON.stringify({
            id: lineId,
            variant_id: variantId,
            product_id: line.product_id,
            quantity: 0,
          }),
        }),
      );
    }
    attempts.push(() =>
      fetch(root + '/api/cart/update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: cartHeaders(true),
        body: JSON.stringify({
          id: lineId,
          variant_id: variantId,
          quantity: 0,
        }),
      }),
    );
    const cartHost = document.querySelector('spz-cart');
    if (cartHost && lineId && typeof cartHost.delete === 'function') {
      try {
        cartHost.delete(lineId);
        return;
      } catch {
        /* fall through to HTTP */
      }
    }
    let lastErr = 'remove line';
    for (const send of attempts) {
      const res = await send();
      if (res.ok) return;
      lastErr = await readCartError(res);
    }
    throw new Error(lastErr);
  }

  async function stripProtectionFromCart() {
    if (!cfg) return;
    const cart = await fetchCart();
    const lines = (cart.line_items || []).filter((i) => isProtectionLine(i));
    for (const line of lines) {
      await removeLine(line);
    }
  }

  async function addProtectionLine(variantId) {
    const root = cartRoot();
    const res = await fetch(root + '/api/cart', {
      method: 'POST',
      headers: cartHeaders(true),
      credentials: 'same-origin',
      body: JSON.stringify({
        product_id: cfg.productId,
        variant_id: variantId,
        quantity: 1,
        refer_info: { source: 'add_to_cart' },
      }),
    });
    if (!res.ok) throw new Error(await readCartError(res));
    const payload = await res.json();
    const state = payload.state;
    if (state && state !== 'success' && state !== '0' && state !== 0) {
      throw new Error(payload.message || 'add protection');
    }
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
    const protectLines = items.filter((i) => isProtectionLine(i));

    if (want && picked) {
      const lines = protectLines.filter((l) => (Number(l.quantity) || 1) > 0);
      if (
        lines.length === 1 &&
        String(lines[0].variant_id) === String(picked.variant.id) &&
        Number(lines[0].quantity || 1) === 1 &&
        protectLines.length === lines.length
      ) {
        return { picked, ok: true };
      }
      for (const line of protectLines) {
        await removeLine(line);
      }
      await addProtectionLine(picked.variant.id);
      return { picked, ok: true };
    }

    if (!want || !picked) {
      for (const line of protectLines) {
        await removeLine(line);
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

  function payableTotal(withProtection, subtotal, picked) {
    const fee = withProtection && picked?.variant ? money(picked.variant.price) : 0;
    return Math.round((money(subtotal) + fee) * 100) / 100;
  }

  function updateCheckoutLabel(subtotal, picked) {
    if (!checkoutEl) return;
    if (!checkoutEl.dataset.sssOriginalText) {
      checkoutEl.dataset.sssOriginalText = (checkoutEl.textContent || '').trim();
    }
    const original = checkoutEl.dataset.sssOriginalText;
    const sub = subtotal == null ? lastSubtotal : subtotal;
    const pick = picked === undefined ? lastPicked : picked;
    const total = payableTotal(true, sub, pick);
    checkoutEl.textContent = original + '  ' + formatPrice(total);
  }

  function setErrorVisible(show, message) {
    if (!errorEl) return;
    errorEl.hidden = !show;
    if (show && message) errorEl.textContent = message;
    if (show && !message) errorEl.textContent = 'Unable to add protection.';
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
    lastSubtotal = sub;
    lastPicked = picked;
    updatePriceDisplay(picked);
    updateCheckoutLabel(sub, picked);
    return { cart, picked };
  }

  async function syncCart(wantProtection) {
    if (!cfg) return;
    const run = async () => {
      setErrorVisible(false);
      try {
        const cart = await fetchCart();
        await ensureProtection(cart, wantProtection);
        await render();
      } catch (err) {
        if (wantProtection) setErrorVisible(true, err && err.message);
        throw err;
      }
    };
    const next = syncQueue.then(run, run);
    syncInFlight = next.catch(() => {});
    syncQueue = syncInFlight;
    return next;
  }

  function triggerNativeCheckout() {
    const cartHost =
      (checkoutEl && checkoutEl.closest && checkoutEl.closest('spz-cart, spz-checkout')) ||
      document.querySelector('spz-cart, spz-checkout');
    if (cartHost && typeof cartHost.checkout === 'function') {
      cartHost.checkout();
      return;
    }
    passThroughCheckout = true;
    try {
      checkoutEl.click();
    } finally {
      setTimeout(() => {
        passThroughCheckout = false;
      }, 1500);
    }
  }

  function checkoutRedirectUrl(payload) {
    const data = payload.data || payload;
    let url = data.checkout_url || data.redirect_url;
    if (!url && data.order_token) url = '/checkout/' + data.order_token;
    const key = data.key || data.order_key;
    if (url && key && !/[?&]key=/.test(url)) {
      url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
    }
    return url;
  }

  async function startCheckoutSession(withProtection) {
    const cart = await fetchCart();
    const goods = (cart.line_items || []).filter(
      (i) => !isProtectionLine(i) && (Number(i.quantity) || 0) > 0 && i.variant_id,
    );
    const line_items = goods.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      quantity: Number(i.quantity) || 1,
    }));
    if (withProtection) {
      const sub = eligibleSubtotal(cart.line_items, cfg.productId);
      const picked = pickVariant({
        subtotal: sub,
        rate: cfg.rate,
        maxCovered: cfg.maxCovered,
        variants: cfg.variants,
      });
      if (picked) {
        line_items.push({
          product_id: cfg.productId,
          variant_id: picked.variant.id,
          quantity: 1,
        });
      }
    }
    if (!line_items.length) throw new Error('empty cart');
    const root = cartRoot();
    const res = await fetch(root + '/api/checkout/order', {
      method: 'POST',
      credentials: 'same-origin',
      headers: cartHeaders(true),
      body: JSON.stringify({
        line_items,
        refer_info: { source: 'cart' },
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.message || payload.msg || 'HTTP ' + res.status);
    }
    const url = checkoutRedirectUrl(payload);
    if (!url) throw new Error(payload.message || 'checkout failed');
    window.location.assign(/^https?:\/\//i.test(url) ? url : root + url);
  }

  async function goCheckout(options) {
    const want = !!(options && options.withProtection);
    setErrorVisible(false);
    try {
      await startCheckoutSession(want);
    } catch (err) {
      setErrorVisible(true, err && err.message);
      triggerNativeCheckout();
    }
  }

  function onCartEvent() {
    if (syncInFlight || passThroughCheckout) {
      render();
      return;
    }
    stripProtectionFromCart()
      .catch(() => {})
      .then(() => render());
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
      '<div class="sss-price"></div>' +
      '<div class="sss-error" hidden>Unable to add protection.</div>';

    withoutLink = document.createElement('a');
    withoutLink.href = '#';
    withoutLink.className = 'sss-without';
    withoutLink.textContent = 'Checkout without protection';

    priceEl = widgetEl.querySelector('.sss-price');
    errorEl = widgetEl.querySelector('.sss-error');

    const parent = checkoutEl.parentNode;
    parent.insertBefore(widgetEl, checkoutEl);
    if (checkoutEl.nextSibling) {
      parent.insertBefore(withoutLink, checkoutEl.nextSibling);
    } else {
      parent.appendChild(withoutLink);
    }

    checkoutEl.addEventListener(
      'click',
      (e) => {
        if (passThroughCheckout) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        goCheckout({ withProtection: true });
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
    stripProtectionFromCart()
      .catch(() => {})
      .then(() => render());
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

    const start = async () => {
      await waitForCartItems(8000);
      try {
        await stripProtectionFromCart();
      } catch {
        /* still mount widget */
      }
      await new Promise((r) => setTimeout(r, 400));
      const checkout = await waitForCheckout(8000);
      if (checkout) {
        mount(checkout);
        return;
      }
      const anchor = fallbackAnchor();
      if (!anchor) return;
      const dummy = document.createElement('button');
      dummy.type = 'button';
      dummy.style.display = 'none';
      dummy.dataset.sssOriginalText = 'Checkout';
      dummy.addEventListener('click', () => {
        window.location.href = cartRoot() + '/checkout';
      });
      anchor.appendChild(dummy);
      mount(dummy);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  })();
})();
