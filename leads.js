/* Navidad a la Malagueña · envío de pedidos a la hoja, aviso de cookies, ventana de bienvenida y botón de WhatsApp */
(function () {
  'use strict';

  // URL del Google Apps Script que guarda cada pedido en Google Sheets y avisa por email.
  var LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxjQ2i-z7PHDuskNQLqPwAKcBw0sXLXMZP4f94dOLwlGEAzlJoM75doyvA_MIkFiEfk0w/exec';
  var CONSENT_KEY = 'nm_cookies_v1';
  var CONSENT_DIAS = 365;
  // Google Analytics 4 (solo se carga si la persona acepta las cookies analíticas)
  var GA_ID = 'G-8YW2FHYV0J';
  var WHATSAPP = '34744475239';
  var VENTANA_SEGUNDOS = 2;
  // Páginas donde la ventana estorbaría (pedido en curso, vuelta del pago y textos legales)
  var SIN_VENTANA = /^\/(pedido|gracias|aviso-legal|condiciones-venta|politica-cookies|politica-privacidad)(\.html)?\/?$/;

  function leer(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function leerSes(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function guardarSes(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
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
  var gaCargado = false;
  function cargarAnalitica() {
    if (!GA_ID || gaCargado) return;
    gaCargado = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  function borrarCookiesGA() {
    var dom = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (k) {
      var n = k.split('=')[0].trim();
      if (!/^_ga/.test(n)) return;
      ['', '; domain=.' + dom, '; domain=' + location.hostname].forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }
  function aplicarConsentimiento(c) {
    window.nmConsent = c;
    if (!c || !c.analiticas) {
      // Si rechaza o retira el permiso: deja de medir y borra las cookies de Google Analytics
      if (gaCargado && window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      borrarCookiesGA();
      return;
    }
    cargarAnalitica();
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
      '<p>Usamos almacenamiento técnico para que la web funcione y recordar tus preferencias. Solo usamos cookies de analítica (Google Analytics) si nos das permiso. ' +
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
      '<span><b>Analíticas.</b><small>Google Analytics: nos ayuda a saber cuántas personas visitan la web, desde dónde llegan y qué páginas funcionan mejor. Solo se carga con tu permiso.</small></span></label>' +
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

  // ===== Botón flotante de WhatsApp (todas las páginas) =====
  var ICONO_WA = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z"/></svg>';
  function enlaceWhatsApp(texto) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto || '¡Hola! Tengo una pregunta sobre la caja de dulces de Navidad a la Malagueña.');
  }
  function crearBotonWhatsApp() {
    var a = document.createElement('a');
    a.className = 'wa-flotante';
    a.href = enlaceWhatsApp();
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    a.innerHTML = ICONO_WA + '<span>¿Dudas? Escríbenos</span>';
    document.body.appendChild(a);
  }

  // ===== Ventana a los 2 segundos: más información (a la hoja) o encargar y pagar =====
  var ventana, focoPrevio;
  function crearVentana() {
    ventana = document.createElement('div');
    ventana.className = 'capa-fondo';
    ventana.hidden = true;
    ventana.innerHTML =
      '<div class="capa-velo" data-v="cerrar"></div>' +
      '<div class="capa-dialogo ventana-info" role="dialog" aria-modal="true" aria-labelledby="ventanaTitulo">' +
      '<button type="button" class="cerrar" data-v="cerrar" aria-label="Cerrar">✕</button>' +
      '<div data-v-form-caja>' +
      '<p class="ventana-etiqueta">Caja de dulces de Navidad · 25 €</p>' +
      '<h2 id="ventanaTitulo">¿Quieres más <em>información?</em></h2>' +
      '<p class="ventana-entradilla">Déjanos tus datos y te escribimos por WhatsApp con todo.</p>' +
      '<form novalidate data-v-form>' +
      '<div class="sr" aria-hidden="true"><label>No rellenar<input name="web" type="text" tabindex="-1" autocomplete="off" /></label></div>' +
      '<label class="campo">Nombre<input name="nombre" type="text" autocomplete="name" placeholder="Carmen Ruiz" required />' +
      '<span class="error" data-v-error="nombre" hidden>Dinos cómo te llamas.</span></label>' +
      '<label class="campo">Móvil (WhatsApp)<input name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="600 000 000" required />' +
      '<span class="error" data-v-error="telefono" hidden>Pon un móvil válido.</span></label>' +
      '<label class="campo">Email<input name="email" type="email" autocomplete="email" placeholder="carmen@email.com" required />' +
      '<span class="error" data-v-error="email" hidden>Ese email no parece válido.</span></label>' +
      '<label class="ventana-rgpd"><input name="rgpd" type="checkbox" required />' +
      '<span>He leído la <a href="/politica-privacidad">política de privacidad</a> y quiero que me escribáis por WhatsApp y email con la información de la caja.</span></label>' +
      '<span class="error" data-v-error="rgpd" hidden>Necesitamos tu permiso para escribirte.</span>' +
      '<button type="submit" class="btn btn-tinta btn-ancho" data-v-enviar>Quiero más información</button>' +
      '</form>' +
      '</div>' +
      '<div class="ventana-ok" data-v-ok hidden>' +
      '<h2>¡Apuntado, <em data-v-nombre>illo</em>!</h2>' +
      '<p class="ventana-entradilla">Te escribimos muy pronto por WhatsApp. Si no quieres esperar, puedes encargar tu caja ya.</p>' +
      '</div>' +
      '<div class="ventana-o"><span>o si ya lo tienes claro</span></div>' +
      '<a class="btn btn-miel btn-ancho" href="/pedido" data-v-pagar>Encargar y pagar · 25 €</a>' +
      '<p class="ventana-pago">Pago seguro con tarjeta, Apple Pay o Google Pay. Entrega gratis en Málaga capital y Torremolinos.</p>' +
      '<a class="ventana-wa" href="' + enlaceWhatsApp('¡Hola! Quiero más información sobre la caja de dulces de Navidad a la Malagueña.') + '" target="_blank" rel="noopener">' + ICONO_WA + 'Prefiero preguntar por WhatsApp</a>' +
      '<p class="info-legal" data-v-legal>Responsable: Asociación Junior Empresa Vyseon. Finalidad: responderte y, si te animas, gestionar tu pedido. Legitimación: tu consentimiento. No cedemos tus datos. Derechos de acceso, rectificación y supresión en la <a href="/politica-privacidad">política de privacidad</a>.</p>' +
      '</div>';
    document.body.appendChild(ventana);

    var form = ventana.querySelector('[data-v-form]');
    var validar = {
      nombre: function (el) { return el.value.trim().length >= 2; },
      telefono: function (el) {
        var c = el.value.replace(/[\s\-().]/g, '');
        return /^[6789]\d{8}$/.test(c.replace(/^(\+34|0034)/, '')) || /^\+\d{9,15}$/.test(c);
      },
      email: function (el) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim()); },
      rgpd: function (el) { return el.checked; }
    };
    function comprobar(n) {
      var el = form.elements[n], ok = validar[n](el);
      ventana.querySelector('[data-v-error="' + n + '"]').hidden = ok;
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      return ok;
    }
    Object.keys(validar).forEach(function (n) {
      var el = form.elements[n];
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'blur', function () { comprobar(n); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var malos = Object.keys(validar).filter(function (n) { return !comprobar(n); });
      if (malos.length) {
        var d = ventana.querySelector('.capa-dialogo');
        d.classList.remove('agita'); void d.offsetWidth; d.classList.add('agita');
        form.elements[malos[0]].focus();
        return;
      }
      if (form.elements.web.value) return; // trampa anti-spam
      var data = {
        nombre: form.elements.nombre.value.trim(),
        telefono: form.elements.telefono.value.trim(),
        email: form.elements.email.value.trim(),
        consentimiento: 'true',
        origen: 'VENTANA 2 s · pide más información',
        pagina: location.pathname,
        referencia: document.referrer || '',
        utm: location.search || '',
        fecha: new Date().toISOString()
      };
      var btn = ventana.querySelector('[data-v-enviar]');
      btn.disabled = true;
      btn.textContent = 'Precalentando el horno…';
      var tope = new Promise(function (r) { setTimeout(r, 2500); });
      Promise.race([window.nmEnviarLead(data).catch(function () {}), tope]).then(function () {
        guardar('nm_apuntado', '1');
        ventana.querySelector('[data-v-nombre]').textContent = data.nombre.split(' ')[0];
        ventana.querySelector('[data-v-form-caja]').hidden = true;
        ventana.querySelector('[data-v-ok]').hidden = false;
        ventana.querySelector('.ventana-o span').textContent = '¿Te animas ya?';
        ventana.querySelector('[data-v-pagar]').focus();
        if (typeof window.fbq === 'function') { try { window.fbq('track', 'Lead'); } catch (err) {} }
        if (typeof window.gtag === 'function') { try { window.gtag('event', 'generate_lead'); } catch (err) {} }
      });
    });

    ventana.addEventListener('click', function (e) {
      if (e.target.closest('[data-v="cerrar"]')) cerrarVentana();
    });
    document.addEventListener('keydown', function (e) {
      if (ventana.hidden) return;
      if (e.key === 'Escape') { cerrarVentana(); return; }
      if (e.key === 'Tab') { // el foco no se escapa de la ventana
        var f = $$('button, a[href], input:not([tabindex="-1"])', ventana.querySelector('.capa-dialogo')).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
  function abrirVentana() {
    // No la abrimos encima de otra ventana (p. ej. el panel de cookies) ni si ya se ha visto en esta visita
    if (!panel.hidden || leerSes('nm_ventana_vista')) return;
    guardarSes('nm_ventana_vista', '1');
    focoPrevio = document.activeElement;
    ventana.hidden = false;
    document.documentElement.classList.add('con-ventana');
    ventana.querySelector('.cerrar').focus();
  }
  function cerrarVentana() {
    ventana.hidden = true;
    document.documentElement.classList.remove('con-ventana');
    if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
  }

  function iniciar() {
    crearBanner();
    crearBotonWhatsApp();
    if (!SIN_VENTANA.test(location.pathname) && !leer('nm_apuntado') && !leerSes('nm_ventana_vista')) {
      crearVentana();
      setTimeout(abrirVentana, VENTANA_SEGUNDOS * 1000);
    }
    var c = leerConsentimiento();
    if (c) aplicarConsentimiento(c); else banner.hidden = false;
    // Enlaces «Configurar cookies» del pie y de la política
    $$('[data-config-cookies]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); abrirPanel(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
