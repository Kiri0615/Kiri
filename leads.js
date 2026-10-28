/* Navidad a la Malagueña · envío de pedidos a la hoja y aviso de cookies */
(function () {
  'use strict';

  // URL del Google Apps Script que guarda cada pedido en Google Sheets y avisa por email.
  var LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxjQ2i-z7PHDuskNQLqPwAKcBw0sXLXMZP4f94dOLwlGEAzlJoM75doyvA_MIkFiEfk0w/exec';
  var CONSENT_KEY = 'nm_cookies_v1';
  var CONSENT_DIAS = 365;

  function leer(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // Apps Script no admite CORS: se envía como formulario "no-cors" (sin preflight).
  window.nmEnviarLead = function (data) {
    if (!LEAD_ENDPOINT) return Promise.reject(new Error('sin-endpoint'));
    return fetch(LEAD_ENDPOINT, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) });
  };

  // ===== Banner y configuración de cookies (LSSI art. 22.2 + Guía AEPD) =====
  var banner, panel;
  function leerConsentimiento() {
    var raw = leer(CONSENT_KEY);
    if (!raw) return null;
    try {
      var c = JSON.parse(raw);
      if (!c.fecha || (Date.now() - c.fecha) > CONSENT_DIAS * 864e5) return null;
      return c;
    } catch (e) { return null; }
  }
  function guardarConsentimiento(analiticas) {
    var c = { tecnicas: true, analiticas: !!analiticas, fecha: Date.now() };
    guardar(CONSENT_KEY, JSON.stringify(c));
    aplicarConsentimiento(c);
    banner.hidden = true;
    panel.hidden = true;
  }
  // Activa scripts opcionales solo con permiso: <script type="text/plain" data-cookies="analiticas" src="..."></script>
  function aplicarConsentimiento(c) {
    window.nmConsent = c;
    if (!c || !c.analiticas) return;
    $$('script[type="text/plain"][data-cookies="analiticas"]').forEach(function (old) {
      var s = document.createElement('script');
      if (old.src) s.src = old.src; else s.text = old.text;
      old.parentNode.replaceChild(s, old);
    });
  }
  function crearBanner() {
    banner = document.createElement('div');
    banner.className = 'capa-cookies';
    banner.hidden = true;
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Aviso de cookies');
    banner.innerHTML =
      '<h2>Cookies, las justas</h2>' +
      '<p>Usamos almacenamiento técnico para que la web funcione y recordar tus preferencias. Solo usaríamos cookies de analítica si nos das permiso. ' +
      'Más en la <a href="/politica-cookies">política de cookies</a>.</p>' +
      '<div class="capa-botones">' +
      '<button type="button" data-c="rechazar">Rechazar</button>' +
      '<button type="button" data-c="configurar">Configurar</button>' +
      '<button type="button" data-c="aceptar">Aceptar</button>' +
      '</div>';
    document.body.appendChild(banner);

    panel = document.createElement('div');
    panel.className = 'capa-fondo';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="capa-velo" data-c="cerrar"></div>' +
      '<div class="capa-dialogo" role="dialog" aria-modal="true" aria-labelledby="cookiesTitulo">' +
      '<button type="button" class="cerrar" data-c="cerrar" aria-label="Cerrar">✕</button>' +
      '<h2 id="cookiesTitulo">Configurar <em>cookies</em></h2>' +
      '<div class="opciones">' +
      '<label><input type="checkbox" checked disabled />' +
      '<span><b>Técnicas (siempre activas).</b><small>Necesarias para que la web funcione: recordar tu elección de cookies y tu pedido hasta que vuelvas del pago.</small></span></label>' +
      '<label><input type="checkbox" data-c-analiticas />' +
      '<span><b>Analíticas.</b><small>Nos ayudarían a saber cuántas personas visitan la web y qué páginas funcionan mejor. Solo se cargan con tu permiso.</small></span></label>' +
      '</div>' +
      '<div class="botones">' +
      '<button type="button" data-c="rechazar">Rechazar todas</button>' +
      '<button type="button" data-c="guardar">Guardar selección</button>' +
      '<button type="button" data-c="aceptar">Aceptar todas</button>' +
      '</div></div>';
    document.body.appendChild(panel);

    function accion(e) {
      var b = e.target.closest('[data-c]'); if (!b) return;
      var a = b.getAttribute('data-c');
      if (a === 'aceptar') guardarConsentimiento(true);
      else if (a === 'rechazar') guardarConsentimiento(false);
      else if (a === 'guardar') guardarConsentimiento(panel.querySelector('[data-c-analiticas]').checked);
      else if (a === 'configurar') abrirPanel();
      else if (a === 'cerrar') panel.hidden = true;
    }
    banner.addEventListener('click', accion);
    panel.addEventListener('click', accion);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) panel.hidden = true; });
  }
  function abrirPanel() {
    var c = leerConsentimiento();
    panel.querySelector('[data-c-analiticas]').checked = !!(c && c.analiticas);
    panel.hidden = false;
    panel.querySelector('[data-c-analiticas]').focus();
  }

  function iniciar() {
    crearBanner();
    var c = leerConsentimiento();
    if (c) aplicarConsentimiento(c); else banner.hidden = false;
    // Enlaces «Configurar cookies» del pie y de la política
    $$('[data-config-cookies]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); abrirPanel(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
