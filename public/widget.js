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
    return '$' + money(amount).toFixed(2) + ' USD';
  }

  function parseMoney(text) {
    const m = String(text || '')
      .replace(/,/g, '')
      .match(/(\d+(?:\.\d+)?)/);
    return m ? money(m[1]) : NaN;
  }

  function writeMoney(el, next) {
    const raw = el.textContent || '';
    const hit = raw.match(/(\d[\d,]*(?:\.\d+)?)/);
    const decimals = hit && hit[0].includes('.') ? (hit[0].split('.')[1] || '').length : 2;
    const num = money(next).toFixed(decimals > 0 ? decimals : 2);
    if (hit) el.textContent = raw.replace(/\d[\d,]*(?:\.\d+)?/, num);
    else el.textContent = num;
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
    return findAllCheckoutEls()[0] || null;
  }

  function findAllCheckoutEls() {
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
      if (el.dataset.sssBound) continue;
      if (!isVisible(el) || !looksLikeCheckout(el)) continue;
      const inSummary = el.closest(
        '#cart-summary-render, [id*="cart-summary"], spz-checkout, .cart-footer, [class*="cart-summary"]',
      );
      const inDrawer = el.closest(
        '[class*="drawer"], [class*="Drawer"], [class*="mini-cart"], [class*="minicart"], [class*="MiniCart"], [class*="sidecart"], [class*="cart-popup"], [class*="CartPopup"], [role="dialog"]',
      );
      scored.push({ el, score: (inDrawer ? 3 : 0) + (inSummary ? 2 : 1) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.el);
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

  const SUMMARY_SEL =
    '#cart-summary-render, [id*="cart-summary"], [id*="CartDrawer"], [id*="cart-drawer"], .cart-footer, [class*="cart-summary"], [class*="cart-footer"], [class*="CartFooter"], [class*="drawer"], [class*="Drawer"], [class*="mini-cart"], [class*="minicart"], [class*="MiniCart"], [class*="sidecart"], [class*="cart-popup"], [class*="CartPopup"], [role="dialog"]';

  function summaryRoot(checkout) {
    return (checkout && checkout.closest(SUMMARY_SEL)) || (checkout && checkout.parentElement) || document.body;
  }

  function totalLineText(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 80) return false;
    if (/sub[\s-]?total/i.test(t)) return false;
    return /^(total|总计|合计)\s*:?\s*(\$|USD|US\$)?\s*[\d,]*/i.test(t);
  }

  function isTotalRow(el, checkout) {
    if (!el || el === checkout || el.closest('.sss-widget')) return false;
    if (checkout && (el === checkout || el.contains(checkout))) return false;
    if (el.querySelector && el.querySelector('button, a[href*="checkout"], .sss-widget')) return false;
    return totalLineText(el.textContent);
  }

  function expandTotalRow(el, root, checkout) {
    let row = el;
    while (row.parentElement && row.parentElement !== root) {
      const parent = row.parentElement;
      if (checkout && parent.contains(checkout)) break;
      if (!totalLineText(parent.textContent)) break;
      row = parent;
    }
    return row;
  }

  function findInsertTarget(checkout) {
    const root = summaryRoot(checkout);
    let best = null;
    const nodes = root.querySelectorAll('div, tr, li, p, dl, dt, dd, section, span, strong, b, em');
    for (const el of nodes) {
      if (!isTotalRow(el, checkout)) continue;
      const pos = el.compareDocumentPosition(checkout);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) best = el;
    }
    return best ? expandTotalRow(best, root, checkout) : checkout;
  }

  function findAmountNode(row) {
    const els = [row, ...row.querySelectorAll('*')];
    let hit = null;
    for (const el of els) {
      if (el.closest && el.closest('.sss-widget')) continue;
      if (el.children && el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 40 && /\$?\s*\d[\d,]*(\.\d+)?/.test(t) && !/^(total|总计|合计)/i.test(t)) {
        hit = el;
      }
    }
    return hit;
  }

  function placeWidget(widget, checkout) {
    if (!widget || !checkout) return;
    const target = findInsertTarget(checkout);
    if (!target || !target.parentNode || target === widget) return;
    if (target !== checkout) target.setAttribute('data-sss-total-row', '1');
    if (widget.nextElementSibling === target) return;
    target.parentNode.insertBefore(widget, target);
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
  let wantProtection = true;
  let paintedFee = 0;
  let publicBase = '';
  let infoModalReady = false;
  let lastInfoModalTrigger = null;
  let modalStylesPromise = null;

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
  box-sizing: border-box;
  width: 100%;
  margin: 0 0 12px;
  padding: 10px 12px 9px;
  border: 1px solid #e6eee6;
  border-radius: 12px;
  background: #fff;
  font-family: inherit;
  color: #1a1a1a;
  text-align: left;
}
.sss-widget[hidden] { display: none !important; }
.sss-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sss-check {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin: 0;
  border-radius: 50%;
  border: 2px solid #2d6a4f;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  padding: 0;
}
.sss-widget.is-on .sss-check {
  background: #1b4332;
  border-color: #1b4332;
}
.sss-check svg { display: none; width: 10px; height: 10px; }
.sss-widget.is-on .sss-check svg { display: block; }
.sss-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.35;
  color: #111;
}
.sss-name { font-weight: 700; }
.sss-info {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #888;
  color: #666;
  font-size: 10px;
  line-height: 12px;
  text-align: center;
  cursor: pointer;
  font-weight: 600;
  background: transparent;
  padding: 0;
  font-family: inherit;
}
.sss-info:hover { border-color: #555; color: #333; }
.sss-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: #222;
}
.sss-powered {
  margin: 6px 0 0;
  font-size: 10px;
  color: #888;
}
.sss-powered strong { color: #3C5C38; font-weight: 700; }
.sss-error {
  margin: 8px 0 0;
  color: #b00020;
  font-size: 12px;
}
`;
    document.head.appendChild(style);
  }

  function injectModalStyles() {
    if (modalStylesPromise) return modalStylesPromise;
    const existing = document.getElementById('sss-wf-modal-css');
    if (existing) {
      modalStylesPromise = Promise.resolve();
      return modalStylesPromise;
    }
    const base = publicBase || (document.currentScript?.src || '').replace(/\/widget\.js.*$/, '');
    if (!base) {
      modalStylesPromise = Promise.resolve();
      return modalStylesPromise;
    }
    const link = document.createElement('link');
    link.id = 'sss-wf-modal-css';
    link.rel = 'stylesheet';
    link.href = base.replace(/\/$/, '') + '/wf-modal.css';
    modalStylesPromise = new Promise((resolve) => {
      const done = () => resolve();
      link.addEventListener('load', done, { once: true });
      link.addEventListener('error', done, { once: true });
      setTimeout(done, 4000);
    });
    document.head.appendChild(link);
    if (!document.getElementById('sss-wf-modal-guard')) {
      const guard = document.createElement('style');
      guard.id = 'sss-wf-modal-guard';
      guard.textContent =
        '.wf-modal-container-v3 .wf-cta-wrap{display:flex!important;justify-content:center!important;width:100%!important}' +
        '.wf-modal-container-v3 button.wf-button-v3{display:flex!important;flex-flow:row nowrap!important;white-space:nowrap!important;max-width:min(343px,100%)!important;margin-left:auto!important;margin-right:auto!important}' +
        '.wf-modal-container-v3 button.wf-button-v3 .wf-cta-label,.wf-modal-container-v3 button.wf-button-v3 .wf-cta-price{display:inline!important;white-space:nowrap!important;width:auto!important;flex:0 0 auto!important}';
      document.head.appendChild(guard);
    }
    return modalStylesPromise;
  }

  function isInfoModalOpen() {
    const dlg = document.getElementById('sss-info-modal');
    return !!(dlg && dlg.open);
  }

  function isSssModalMutationNode(node) {
    if (!(node instanceof Element)) return false;
    if (node.id === 'sss-info-modal') return true;
    return !!node.closest('#sss-info-modal');
  }

  function lockScrollForModal() {
    const gap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (gap > 0) document.documentElement.style.setProperty('--sss-scrollbar-gw', gap + 'px');
    else document.documentElement.style.removeProperty('--sss-scrollbar-gw');
  }

  function unlockScrollForModal() {
    document.documentElement.style.removeProperty('--sss-scrollbar-gw');
  }

  function preloadInfoModalImages(dlg) {
    if (!dlg) return;
    dlg.querySelectorAll('img[src]').forEach((img) => {
      if (img.complete) return;
      const pre = new Image();
      pre.decoding = 'async';
      pre.src = img.src;
    });
  }

  function scheduleInfoModalPreload() {
    const run = () => {
      injectModalStyles();
      ensureInfoModal();
      const dlg = document.getElementById('sss-info-modal');
      preloadInfoModalImages(dlg);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 400);
  }

  function wfAsset(file) {
    const base = publicBase || (document.currentScript?.src || '').replace(/\/widget\.js.*$/, '');
    return (base ? base.replace(/\/$/, '') : '') + '/wf/' + file;
  }

  function formatFeeShort(amount) {
    return '$' + money(amount).toFixed(2);
  }

  function ensureInfoModal() {
    if (document.getElementById('sss-info-modal')) {
      infoModalReady = true;
      return;
    }
    injectModalStyles();
    const dlg = document.createElement('dialog');
    dlg.id = 'sss-info-modal';
    dlg.className = 'wf-modal-container-v3';
    dlg.setAttribute('aria-labelledby', 'sss-wf-modal-title');
    dlg.innerHTML =
      '<div class="wf-modal-v3">' +
      '<button type="button" class="wf-modal-close-v3" aria-label="Close" data-wf-modal-close="">' +
      '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M1 1L13 13M13 1L1 13" fill="none" stroke="#2E4A28" stroke-width="2" stroke-linecap="round"></path>' +
      '</svg></button>' +
      '<div class="wf-modal-header">' +
      '<img class="wf-modal-hero" src="' +
      wfAsset('hero.jpg') +
      '" width="1459" height="600" alt="GOOVAL shipping secure service — more peace of mind for every order">' +
      '</div>' +
      '<div class="wf-modal-content-section">' +
      '<div class="wf-benefits-panel">' +
      '<div class="wf-benefits-title" id="sss-wf-modal-title">' +
      '<img src="' +
      wfAsset('ic-shield.png') +
      '" width="165" height="192" alt="">' +
      '<span>Shipping Secure Benefits</span></div>' +
      '<div class="wf-benefits-grid">' +
      '<div class="wf-benefit-item"><img src="' +
      wfAsset('ic-lost.png') +
      '" alt=""><span>Lost<br>in Transit</span></div>' +
      '<div class="wf-benefit-item"><img src="' +
      wfAsset('ic-damaged.png') +
      '" alt=""><span>Damaged<br>in Transit</span></div>' +
      '<div class="wf-benefit-item"><img src="' +
      wfAsset('ic-delay.png') +
      '" alt=""><span>Delivery<br>Delay</span></div>' +
      '<div class="wf-benefit-item"><img src="' +
      wfAsset('ic-theft.png') +
      '" alt=""><span>Theft/<br>Porch Piracy</span></div>' +
      '</div></div>' +
      '<div class="wf-highlight-row">' +
      '<div class="wf-highlight wf-highlight--green">' +
      '<img src="' +
      wfAsset('ic-rapid.png') +
      '" alt="">' +
      '<div class="wf-highlight-text"><div class="wf-highlight-title">Rapid Resolution</div>' +
      '<div class="wf-highlight-desc">Quick and easy claims resolution</div></div></div>' +
      '<div class="wf-highlight wf-highlight--cream">' +
      '<img src="' +
      wfAsset('ic-support.png') +
      '" alt="">' +
      '<div class="wf-highlight-text"><div class="wf-highlight-title">24/7 Support</div>' +
      '<div class="wf-highlight-desc">Fast, reliable help around the clock</div></div></div>' +
      '</div>' +
      '<div class="wf-cta-wrap">' +
      '<button type="button" class="wf-button-v3" data-wf-modal-opt-in="">' +
      '<span class="wf-cta-label">Add Shipping Secure Service Now</span>' +
      '<span class="wf-cta-price" data-wf-modal-price="">$0.00</span></button></div>' +
      '<div class="wf-no-need" role="button" tabindex="0" data-wf-modal-opt-out="">Continue Without Service Benefits</div>' +
      '<div class="wf-modal-footer">' +
      '<a href="https://www.gooval.io/privacy" target="_blank" rel="noopener" class="wf-modal-footer-link">Privacy Policy</a>' +
      '<div class="wf-modal-footer-powered">Powered by <b>GOOVAL</b></div>' +
      '<a href="https://www.gooval.io/terms" target="_blank" rel="noopener" class="wf-modal-footer-link">Terms of Service</a>' +
      '</div></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeInfoModal();
    });
    dlg.querySelector('.wf-modal-v3').addEventListener('click', (e) => e.stopPropagation());
    dlg.querySelector('[data-wf-modal-close]').addEventListener('click', closeInfoModal);
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeInfoModal();
    });
    dlg.querySelector('[data-wf-modal-opt-in]').addEventListener('click', () => {
      checkoutFromModal(true);
    });
    const optOut = dlg.querySelector('[data-wf-modal-opt-out]');
    optOut.addEventListener('click', () => {
      checkoutFromModal(false);
    });
    optOut.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        checkoutFromModal(false);
      }
    });
    preloadInfoModalImages(dlg);
    infoModalReady = true;
  }

  async function openInfoModal(trigger) {
    if (trigger instanceof HTMLElement) lastInfoModalTrigger = trigger;
    injectStyles();
    await injectModalStyles();
    ensureInfoModal();
    const dlg = document.getElementById('sss-info-modal');
    if (!dlg) return;
    const price = lastPicked?.variant ? formatFeeShort(lastPicked.variant.price) : '';
    const priceEl = dlg.querySelector('[data-wf-modal-price]');
    if (priceEl) priceEl.textContent = price;
    const content = dlg.querySelector('.wf-modal-content-section');
    if (content) content.scrollTop = 0;
    lockScrollForModal();
    if (typeof dlg.showModal === 'function') {
      if (dlg.open) dlg.close();
      dlg.showModal();
    } else {
      dlg.setAttribute('open', 'open');
    }
  }

  function closeInfoModal() {
    const dlg = document.getElementById('sss-info-modal');
    if (!dlg) return;
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
    unlockScrollForModal();
    const back = lastInfoModalTrigger;
    if (back && back.isConnected && typeof back.focus === 'function') {
      try {
        back.focus({ preventScroll: true });
      } catch {
        back.focus();
      }
    }
  }

  function setErrorVisible(show, message) {
    document.querySelectorAll('.sss-error').forEach((el) => {
      el.hidden = !show;
      if (show) el.textContent = message || 'Unable to add protection.';
    });
  }

  function paintTotal() {
    const fee = wantProtection && lastPicked?.variant ? money(lastPicked.variant.price) : 0;
    document.querySelectorAll('[data-sss-total-row]').forEach((row) => {
      const amtEl = findAmountNode(row);
      if (!amtEl) return;
      const shown = parseMoney(amtEl.textContent);
      if (!Number.isFinite(shown)) return;
      const base = Math.round((shown - paintedFee) * 100) / 100;
      writeMoney(amtEl, Math.round((base + fee) * 100) / 100);
    });
    paintedFee = fee;
  }

  function syncWidgetState() {
    document.querySelectorAll('.sss-widget').forEach((el) => {
      el.classList.toggle('is-on', wantProtection);
      const box = el.querySelector('.sss-check');
      if (box) box.setAttribute('aria-checked', wantProtection ? 'true' : 'false');
    });
    paintTotal();
  }

  function updatePriceDisplay(picked) {
    const fee = picked?.variant ? formatPrice(picked.variant.price) : '';
    document.querySelectorAll('.sss-widget').forEach((el) => {
      const has = !!picked?.variant;
      el.hidden = !has;
      const priceEl = el.querySelector('.sss-fee');
      if (priceEl) priceEl.textContent = fee;
    });
    syncWidgetState();
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
    paintedFee = 0;
    updatePriceDisplay(picked);
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

  function triggerNativeCheckout(button) {
    const target = button || checkoutEl;
    const cartHost =
      (target && target.closest && target.closest('spz-cart, spz-checkout')) ||
      document.querySelector('spz-cart, spz-checkout');
    if (cartHost && typeof cartHost.checkout === 'function') {
      cartHost.checkout();
      return;
    }
    passThroughCheckout = true;
    try {
      if (target) target.click();
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
    const want = options && 'withProtection' in options ? !!options.withProtection : wantProtection;
    const button = (options && options.button) || checkoutEl;
    setErrorVisible(false);
    try {
      await startCheckoutSession(want);
    } catch (err) {
      setErrorVisible(true, err && err.message);
      triggerNativeCheckout(button);
    }
  }

  async function checkoutFromModal(withProtection) {
    wantProtection = !!withProtection;
    syncWidgetState();
    closeInfoModal();
    await goCheckout({ withProtection, button: checkoutEl });
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
    if (!checkout || checkout.dataset.sssBound) return;
    checkoutEl = checkout;
    checkout.dataset.sssBound = '1';

    injectStyles();

    const widget = document.createElement('div');
    widget.className = 'sss-widget is-on';
    widget.innerHTML =
      '<div class="sss-head">' +
      '<button type="button" class="sss-check" role="checkbox" aria-checked="true" aria-label="Shipping Secure Service">' +
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M4.7 9.2 1.8 6.3l1.1-1.1 1.8 1.8 4.4-4.4 1.1 1.1z"/></svg>' +
      '</button>' +
      '<div class="sss-title">' +
      '<span><span class="sss-name">Shipping Secure Service</span> for <span class="sss-fee"></span></span>' +
      '<button type="button" class="sss-info" aria-label="Shipping Secure Service benefits">?</button>' +
      '</div></div>' +
      '<p class="sss-desc">Shipping compensation for lost, damaged, or delayed packages, including theft/porch piracy.</p>' +
      '<p class="sss-powered">Powered By <strong>GOOVAL</strong></p>' +
      '<div class="sss-error" hidden>Unable to add protection.</div>';

    placeWidget(widget, checkout);

    widget.querySelector('.sss-check').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wantProtection = !wantProtection;
      syncWidgetState();
    });

    widget.querySelector('.sss-info').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInfoModal(e.currentTarget);
    });

    checkout.addEventListener(
      'click',
      (e) => {
        if (passThroughCheckout) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        goCheckout({ withProtection: wantProtection, button: checkout });
      },
      true,
    );

    mounted = true;
    scheduleInfoModalPreload();
    render();
  }

  function scanAndMount() {
    if (!cfg) return;
    if (isInfoModalOpen()) return;
    findAllCheckoutEls().forEach((el) => mount(el));
    document.querySelectorAll('[data-sss-bound]').forEach((checkout) => {
      const root = summaryRoot(checkout);
      const widget = root && root.querySelector('.sss-widget');
      if (widget) placeWidget(widget, checkout);
    });
  }

  window.syncCart = syncCart;
  window.goCheckout = goCheckout;

  (async function bootstrap() {
    const src = document.currentScript && document.currentScript.src;
    const base = src ? src.replace(/\/widget\.js.*$/, '') : '';
    publicBase = base;
    try {
      const res = await fetch(base + '/widget/config');
      if (!res.ok) throw new Error('config');
      cfg = await res.json();
    } catch {
      return;
    }

    const start = async () => {
      document.addEventListener('dj.cartChange', onCartEvent);
      document.addEventListener('dj.addToCart', () => {
        onCartEvent();
        setTimeout(scanAndMount, 200);
        setTimeout(scanAndMount, 700);
      });
      new MutationObserver((mutations) => {
        const relevant = mutations.some((m) => !isSssModalMutationNode(m.target));
        if (!relevant) return;
        scanAndMount();
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden'],
      });
      if (/\/cart\/?$/.test(location.pathname)) {
        await waitForCartItems(8000);
        try {
          await stripProtectionFromCart();
        } catch {
          /* still mount */
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      scanAndMount();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  })();
})();
