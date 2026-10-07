/* Navidad a la Malagueña · formularios de leads, ventana emergente y banner de cookies */
(function () {
  'use strict';

  // ===== Configuración =====
  // URL del Google Apps Script que guarda cada lead en Google Sheets y avisa por email.
  // Si está vacía o falla, el lead se manda por WhatsApp al negocio: nunca se pierde.
  var LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxjQ2i-z7PHDuskNQLqPwAKcBw0sXLXMZP4f94dOLwlGEAzlJoM75doyvA_MIkFiEfk0w/exec';
  var WHATSAPP_NEGOCIO = '34744475239';
  var POPUP_SEGUNDOS = 5;
  var CONSENT_KEY = 'nm_cookies_v1';
  var CONSENT_DIAS = 365;

  // ===== Utilidades de almacenamiento (técnico, sin cookies de terceros) =====
  function leer(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function guardar(store, k, v) { try { window[store].setItem(k, v); } catch (e) {} }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // ===== Texto legal de primera capa (RGPD) =====
  var INFO_BASICA =
    '<p class="text-[11px] leading-snug text-cafe-soft/90">' +
    '<strong class="font-semibold">Información básica sobre protección de datos.</strong> ' +
    'Responsable: Asociación Junior Empresa Vyseon. Finalidad: avisarte del lanzamiento y la preventa y gestionar tu reserva. ' +
    'Legitimación: tu consentimiento. Destinatarios: no cedemos tus datos; los tratan nuestros proveedores tecnológicos (Google, Vercel). ' +
    'Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad. ' +
    'Más información en la <a href="/politica-privacidad" class="underline underline-offset-2">política de privacidad</a>.</p>';

  // ===== Formulario reutilizable =====
  function campos(pref) {
    return '' +
      '<div class="hidden" aria-hidden="true"><label for="' + pref + 'web">No rellenar</label><input id="' + pref + 'web" name="web" type="text" tabindex="-1" autocomplete="off" /></div>' +
      '<div><label for="' + pref + 'nombre" class="block text-[11px] tracking-label uppercase font-semibold text-cafe-soft">Nombre</label>' +
      '<input id="' + pref + 'nombre" name="nombre" type="text" autocomplete="name" required placeholder="Carmen Ruiz" class="input-linea" />' +
      '<p class="field-error hidden mt-1.5 text-xs text-teja" data-for="nombre">Dinos cómo te llamas.</p></div>' +
      '<div class="grid sm:grid-cols-2 gap-5">' +
      '<div><label for="' + pref + 'telefono" class="block text-[11px] tracking-label uppercase font-semibold text-cafe-soft">Teléfono WhatsApp</label>' +
      '<input id="' + pref + 'telefono" name="telefono" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+34 600 000 000" class="input-linea" />' +
      '<p class="field-error hidden mt-1.5 text-xs text-teja" data-for="telefono">Introduce un móvil válido.</p></div>' +
      '<div><label for="' + pref + 'email" class="block text-[11px] tracking-label uppercase font-semibold text-cafe-soft">Correo electrónico</label>' +
      '<input id="' + pref + 'email" name="email" type="email" autocomplete="email" required placeholder="tu@correo.com" class="input-linea" />' +
      '<p class="field-error hidden mt-1.5 text-xs text-teja" data-for="email">Ese correo no parece válido.</p></div>' +
      '</div>' +
      '<div class="pt-1"><label class="flex items-start gap-3 cursor-pointer select-none">' +
      '<input name="rgpd" type="checkbox" required class="mt-0.5 w-4 h-4 shrink-0 accent-[#2F4A3C] cursor-pointer" />' +
      '<span class="text-[13px] text-cafe-soft leading-snug">He leído la <a href="/politica-privacidad" class="underline underline-offset-2 hover:text-teja">política de privacidad</a> y quiero recibir por WhatsApp y email el aviso del lanzamiento y la preventa.</span></label>' +
      '<p class="field-error hidden mt-1.5 text-xs text-teja" data-for="rgpd">Necesitamos tu consentimiento para poder avisarte.</p></div>';
  }

  var validadores = {
    nombre: function (v) { return v.trim().length >= 2; },
    telefono: function (v) {
      var c = v.replace(/[\s\-().]/g, '');
      return /^[6789]\d{8}$/.test(c.replace(/^(\+34|0034)/, '')) || /^\+\d{9,15}$/.test(c);
    },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    rgpd: function (_, el) { return el.checked; }
  };

  function validar(form, name) {
    var el = form.elements[name];
    if (!el) return true;
    var ok = validadores[name](el.value, el);
    var err = form.querySelector('.field-error[data-for="' + name + '"]');
    if (err) err.classList.toggle('hidden', ok);
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }

  function enviarLead(data) {
    if (!LEAD_ENDPOINT) return Promise.reject(new Error('sin-endpoint'));
    // Apps Script no admite CORS: se envía como formulario "no-cors" (sin preflight).
    return fetch(LEAD_ENDPOINT, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) });
  }

  function leadPorWhatsApp(data) {
    var txt = '¡Hola! Quiero apuntarme a la lista de espera de Navidad a la Malagueña.\nNombre: ' + data.nombre +
      '\nTeléfono: ' + data.telefono + '\nEmail: ' + data.email;
    var url = 'https://wa.me/' + WHATSAPP_NEGOCIO + '?text=' + encodeURIComponent(txt);
    var w = window.open(url, '_blank');
    if (!w) location.href = url;
  }

  function prepararFormulario(form) {
    Object.keys(validadores).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'blur', function () { validar(form, name); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') validar(form, name); });
    });

    var btn = form.querySelector('[type="submit"]');
    var btnText = btn && (btn.querySelector('[data-btn-text]') || btn);
    var textoOriginal = btnText ? btnText.textContent : '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var resultados = Object.keys(validadores).map(function (n) { return validar(form, n); });
      if (resultados.indexOf(false) !== -1) {
        var card = form.closest('[data-lead-card]') || form;
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        var inv = form.querySelector('[aria-invalid="true"]'); if (inv) inv.focus();
        return;
      }
      if (form.elements.web && form.elements.web.value) return; // trampa anti-spam

      var data = {
        nombre: form.elements.nombre.value.trim(),
        telefono: form.elements.telefono.value.trim(),
        email: form.elements.email.value.trim(),
        consentimiento: 'true',
        origen: form.getAttribute('data-lead') || 'web',
        pagina: location.pathname,
        referencia: document.referrer || '',
        utm: location.search || '',
        fecha: new Date().toISOString()
      };

      if (btn) btn.disabled = true;
      if (btnText) btnText.textContent = 'Precalentando el horno…';

      enviarLead(data).then(function () {
        guardar('localStorage', 'nm_apuntado', '1');
        exito(form, data);
      }).catch(function () {
        // Plan B: que el lead llegue igualmente por WhatsApp
        guardar('localStorage', 'nm_apuntado', '1');
        guardar('sessionStorage', 'nm_enviado', JSON.stringify({ nombre: data.nombre.split(' ')[0], via: 'whatsapp' }));
        leadPorWhatsApp(data);
        recargar();
      }); // el botón se queda en «Precalentando el horno…» hasta que la página se refresca
    });
  }

  // Tras enviar: se refresca la página (vuelve arriba, formularios limpios) y sale el mensaje de confirmación
  function exito(form, data) {
    guardar('sessionStorage', 'nm_enviado', JSON.stringify({ nombre: data.nombre.split(' ')[0], via: 'web' }));
    recargar();
  }
  function recargar() {
    setTimeout(function () {
      try { history.scrollRestoration = 'manual'; } catch (e) {}
      window.scrollTo(0, 0);
      location.replace(location.pathname);
    }, 600);
  }

  function mostrarEnviado() {
    var raw = leer('sessionStorage', 'nm_enviado');
    if (!raw) return false;
    try { window.sessionStorage.removeItem('nm_enviado'); } catch (e) {}
    var info = {}; try { info = JSON.parse(raw) || {}; } catch (e) {}
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    window.scrollTo(0, 0);

    var texto = info.via === 'whatsapp'
      ? 'Te hemos abierto WhatsApp con tus datos: dale a <strong>enviar</strong> y listo. En cuanto salga la primera hornada te contactamos, que no se nos escapa ni uno.'
      : 'Tu información de contacto ya se ha enviado. Aliquindoi, que en cuanto tengamos los dulces recién hechos te contactamos por WhatsApp los primeros.';

    var m = document.createElement('div');
    m.className = 'fixed inset-0 z-[65] grid place-items-center p-4';
    m.innerHTML =
      '<div class="absolute inset-0 bg-cafe/60" data-cerrar></div>' +
      '<div role="dialog" aria-modal="true" aria-labelledby="enviadoTitulo" class="popup-in relative w-full max-w-md bg-papel rounded-2xl shadow-suave border border-linea p-7 sm:p-9 text-center">' +
      '<button type="button" data-cerrar class="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full text-cafe hover:bg-fondo focus:outline-none focus:ring-2 focus:ring-teja/40" aria-label="Cerrar">' +
      '<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<svg viewBox="-50 -30 100 60" class="h-16 mx-auto" aria-hidden="true"><use href="#i-pestino"/></svg>' +
      '<p class="mt-3 text-[11px] tracking-label uppercase text-teja font-semibold">¡Chiquillo, qué arte!</p>' +
      '<h2 id="enviadoTitulo" class="mt-2 font-serif text-3xl font-light leading-tight">¡Oído en cocina<span data-n></span>!</h2>' +
      '<p class="mt-3 text-cafe-soft leading-relaxed">' + texto + '</p>' +
      '<p class="mt-4 font-mano text-2xl text-pascuero -rotate-1">Ve haciendo hueco en la mesa, que esto va a ser un bastinazo.</p>' +
      '<button type="button" data-cerrar class="mt-6 inline-flex items-center rounded-full bg-cafe text-papel px-7 py-3.5 text-[13px] font-semibold tracking-wide hover:bg-teja transition">¡Vale, quillo!</button>' +
      '</div>';
    if (info.nombre) m.querySelector('[data-n]').textContent = ', ' + info.nombre;
    if (!document.getElementById('i-pestino')) { var ic = m.querySelector('svg.h-16'); if (ic) ic.remove(); }
    document.body.appendChild(m);
    document.documentElement.style.overflow = 'hidden';
    function cerrar() { m.remove(); document.documentElement.style.overflow = ''; document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') cerrar(); }
    $$('[data-cerrar]', m).forEach(function (b) { b.addEventListener('click', cerrar); });
    document.addEventListener('keydown', esc);
    setTimeout(function () { var b = m.querySelector('button:last-child'); if (b) b.focus(); }, 50);
    return true;
  }

  // ===== Toast de confirmación =====
  var toast, toastTimer;
  function crearToast() {
    toast = document.createElement('div');
    toast.className = 'hidden fixed z-[60] bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<div class="toast-enter flex items-start gap-4 rounded-2xl bg-cafe text-fondo shadow-suave p-5 pr-3"><div class="flex-1">' +
      '<p class="text-[11px] tracking-label uppercase text-arena font-semibold">Confirmado</p>' +
      '<p class="mt-1 font-serif text-xl leading-tight">¡Oído en cocina!</p>' +
      '<p class="text-sm text-fondo/80 mt-1">Te avisaremos por WhatsApp muy pronto.</p></div>' +
      '<button type="button" class="grid place-items-center w-8 h-8 rounded-full hover:bg-fondo/10" aria-label="Cerrar aviso">' +
      '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    toast.querySelector('button').addEventListener('click', function () { toast.classList.add('hidden'); });
    document.body.appendChild(toast);
  }
  function mostrarToast() {
    clearTimeout(toastTimer);
    toast.classList.remove('hidden');
    var inner = toast.firstElementChild;
    inner.classList.remove('toast-enter'); void inner.offsetWidth; inner.classList.add('toast-enter');
    toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 6000);
  }

  // ===== Ventana emergente "¿Quieres más información?" =====
  var popup, ultimoFoco;
  function crearPopup() {
    popup = document.createElement('div');
    popup.id = 'popupLead';
    popup.className = 'hidden fixed inset-0 z-50 grid place-items-center p-4';
    popup.innerHTML =
      '<div class="absolute inset-0 bg-cafe/60" data-cerrar></div>' +
      '<div role="dialog" aria-modal="true" aria-labelledby="popupTitulo" data-lead-card class="popup-in relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-papel rounded-2xl shadow-suave border border-linea p-6 sm:p-9">' +
      '<button type="button" data-cerrar class="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full text-cafe hover:bg-fondo focus:outline-none focus:ring-2 focus:ring-teja/40" aria-label="Cerrar">' +
      '<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<p class="text-[11px] tracking-label uppercase text-teja font-semibold">Hornadas limitadas</p>' +
      '<h2 id="popupTitulo" class="mt-2 font-serif text-3xl font-light leading-tight pr-8">¿Quieres más información? <em class="text-teja font-normal">Deja tus datos aquí</em></h2>' +
      '<p class="mt-2 text-sm text-cafe-soft">Te avisamos por WhatsApp los primeros, con precio especial de preventa para tu pack navideño.</p>' +
      '<form class="mt-5 space-y-5" novalidate data-lead="popup-5s">' + campos('pp-') +
      '<button type="submit" class="w-full rounded-2xl bg-teja hover:bg-teja-dark text-papel px-6 py-4 text-[13px] font-bold tracking-[.06em] shadow-[0_6px_0_#7E2F24] active:translate-y-[6px] active:shadow-none transition disabled:opacity-70"><span data-btn-text>¡QUIERO MÁS INFORMACIÓN!</span></button>' +
      INFO_BASICA + '</form></div>';
    document.body.appendChild(popup);
    $$('[data-cerrar]', popup).forEach(function (b) { b.addEventListener('click', function () { cerrarPopup(true); }); });
    document.addEventListener('keydown', function (e) {
      if (popup.classList.contains('hidden')) return;
      if (e.key === 'Escape') cerrarPopup(true);
      if (e.key === 'Tab') { // mantener el foco dentro de la ventana
        var f = $$('button, a, input', popup.querySelector('[role="dialog"]')).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    prepararFormulario(popup.querySelector('form'));
  }
  function abrirPopup() {
    if (!popup) crearPopup();
    ultimoFoco = document.activeElement;
    popup.classList.remove('hidden');
    document.documentElement.style.overflow = 'hidden';
    var first = popup.querySelector('input[name="nombre"]');
    setTimeout(function () { if (first) first.focus(); }, 50);
  }
  function cerrarPopup(porUsuario) {
    if (!popup || popup.classList.contains('hidden')) return;
    popup.classList.add('hidden');
    document.documentElement.style.overflow = '';
    if (porUsuario) guardar('sessionStorage', 'nm_popup_cerrado', '1');
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }
  function programarPopup() {
    if (leer('localStorage', 'nm_apuntado') === '1' || leer('sessionStorage', 'nm_popup_cerrado') === '1') return;
    setTimeout(function intentar() {
      // No interrumpir si el banner de cookies está abierto o si ya está escribiendo en un formulario
      var activo = document.activeElement;
      if ((banner && !banner.classList.contains('hidden')) || (activo && activo.closest && activo.closest('form'))) {
        setTimeout(intentar, 2000); return;
      }
      if (leer('localStorage', 'nm_apuntado') === '1') return;
      abrirPopup();
    }, POPUP_SEGUNDOS * 1000);
  }

  // ===== Banner y configuración de cookies (LSSI art. 22.2 + Guía AEPD) =====
  var banner, panel;
  function leerConsentimiento() {
    var raw = leer('localStorage', CONSENT_KEY);
    if (!raw) return null;
    try {
      var c = JSON.parse(raw);
      if (!c.fecha || (Date.now() - c.fecha) > CONSENT_DIAS * 864e5) return null;
      return c;
    } catch (e) { return null; }
  }
  function guardarConsentimiento(analiticas) {
    var c = { tecnicas: true, analiticas: !!analiticas, fecha: Date.now() };
    guardar('localStorage', CONSENT_KEY, JSON.stringify(c));
    aplicarConsentimiento(c);
    banner.classList.add('hidden');
    panel.classList.add('hidden');
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
    banner.className = 'hidden fixed z-[55] inset-x-3 bottom-3 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-md';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Aviso de cookies');
    banner.innerHTML =
      '<div class="rounded-2xl bg-papel border border-linea shadow-suave p-5 text-sm text-cafe">' +
      '<p class="font-serif text-lg">Cookies, las justas</p>' +
      '<p class="mt-1.5 text-cafe-soft leading-snug">Usamos almacenamiento técnico necesario para que la web funcione y recordar tus preferencias. Solo usaríamos cookies de analítica si nos das permiso. ' +
      'Más información en la <a href="/politica-cookies" class="underline underline-offset-2">política de cookies</a>.</p>' +
      '<div class="mt-4 grid grid-cols-3 gap-2">' +
      '<button type="button" data-c="rechazar" class="rounded-full border border-cafe px-3 py-2.5 text-[13px] font-semibold hover:bg-fondo">Rechazar</button>' +
      '<button type="button" data-c="configurar" class="rounded-full border border-cafe px-3 py-2.5 text-[13px] font-semibold hover:bg-fondo">Configurar</button>' +
      '<button type="button" data-c="aceptar" class="rounded-full border border-cafe bg-cafe text-papel px-3 py-2.5 text-[13px] font-semibold hover:bg-teja hover:border-teja">Aceptar</button>' +
      '</div></div>';
    document.body.appendChild(banner);

    panel = document.createElement('div');
    panel.className = 'hidden fixed inset-0 z-[70] grid place-items-center p-4';
    panel.innerHTML =
      '<div class="absolute inset-0 bg-cafe/60" data-c="cerrar"></div>' +
      '<div role="dialog" aria-modal="true" aria-labelledby="cookiesTitulo" class="relative w-full max-w-lg bg-papel rounded-2xl border border-linea shadow-suave p-6 sm:p-8 text-sm">' +
      '<button type="button" data-c="cerrar" class="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full hover:bg-fondo" aria-label="Cerrar">' +
      '<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<h2 id="cookiesTitulo" class="font-serif text-2xl">Configurar cookies</h2>' +
      '<div class="mt-5 space-y-4">' +
      '<label class="flex items-start gap-3"><input type="checkbox" checked disabled class="mt-1 w-4 h-4 accent-[#2F4A3C]" />' +
      '<span><strong class="font-semibold">Técnicas (siempre activas).</strong><span class="block text-cafe-soft">Necesarias para que la web funcione: recordar tu elección de cookies y si ya has cerrado la ventana de información.</span></span></label>' +
      '<label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" data-c-analiticas class="mt-1 w-4 h-4 accent-[#2F4A3C]" />' +
      '<span><strong class="font-semibold">Analíticas.</strong><span class="block text-cafe-soft">Nos ayudarían a saber cuántas personas visitan la web y qué páginas funcionan mejor. Ahora mismo no usamos ninguna; si las activamos, solo se cargarán con tu permiso.</span></span></label>' +
      '</div>' +
      '<div class="mt-6 flex flex-wrap gap-2 justify-end">' +
      '<button type="button" data-c="rechazar" class="rounded-full border border-cafe px-4 py-2.5 text-[13px] font-semibold hover:bg-fondo">Rechazar todas</button>' +
      '<button type="button" data-c="guardar" class="rounded-full border border-cafe px-4 py-2.5 text-[13px] font-semibold hover:bg-fondo">Guardar selección</button>' +
      '<button type="button" data-c="aceptar" class="rounded-full border border-cafe bg-cafe text-papel px-4 py-2.5 text-[13px] font-semibold hover:bg-teja hover:border-teja">Aceptar todas</button>' +
      '</div></div>';
    document.body.appendChild(panel);

    function accion(e) {
      var b = e.target.closest('[data-c]'); if (!b) return;
      var a = b.getAttribute('data-c');
      if (a === 'aceptar') guardarConsentimiento(true);
      else if (a === 'rechazar') guardarConsentimiento(false);
      else if (a === 'guardar') guardarConsentimiento(panel.querySelector('[data-c-analiticas]').checked);
      else if (a === 'configurar') abrirPanel();
      else if (a === 'cerrar') panel.classList.add('hidden');
    }
    banner.addEventListener('click', accion);
    panel.addEventListener('click', accion);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.classList.contains('hidden')) panel.classList.add('hidden'); });
  }
  function abrirPanel() {
    var c = leerConsentimiento();
    panel.querySelector('[data-c-analiticas]').checked = !!(c && c.analiticas);
    panel.classList.remove('hidden');
    panel.querySelector('[data-c-analiticas]').focus();
  }

  // ===== Arranque =====
  function iniciar() {
    crearToast();
    crearBanner();
    var c = leerConsentimiento();
    if (c) aplicarConsentimiento(c); else banner.classList.remove('hidden');

    $$('form[data-lead]').forEach(prepararFormulario);
    var recienEnviado = mostrarEnviado();
    $$('[data-info-basica]').forEach(function (el) { el.innerHTML = INFO_BASICA; });

    // Botones que abren la ventana de datos (en páginas sin formulario a la vista)
    $$('[data-abrir-popup]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); abrirPopup(); });
    });
    // Enlaces "Configurar cookies"
    $$('[data-config-cookies]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); abrirPanel(); });
    });

    if (!recienEnviado && !document.body.hasAttribute('data-sin-popup')) programarPopup();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
