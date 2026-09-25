/* ==========================================================================
   ON-TOUCH CONSULTING — JavaScript principal
   Sin dependencias externas. Cada módulo se activa sólo si su marcado
   existe en la página, de modo que el mismo archivo sirve para todo el sitio.
   ========================================================================== */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Marca la página como "con JavaScript" para que las animaciones de entrada
  // se activen. Sin este script el contenido se muestra tal cual, sin ocultarse.
  document.documentElement.classList.add('js');

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------
     Año actual en el pie de página
     ------------------------------------------------------------------ */
  function initYear() {
    $$('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ------------------------------------------------------------------
     Cabecera: fondo al hacer scroll + barra de progreso
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;

    var progress = $('.scroll-progress');

    function onScroll() {
      header.classList.toggle('is-stuck', window.scrollY > 20);

      if (progress) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        progress.style.width = Math.min(100, Math.max(0, pct)) + '%';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------
     Menú móvil
     ------------------------------------------------------------------ */
  function initMobileNav() {
    var toggle = $('.nav__toggle');
    var menu = $('#nav-menu');
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open
        ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    }

    toggle.addEventListener('click', function () {
      setOpen(!menu.classList.contains('is-open'));
    });

    // Cerrar al pulsar un enlace o al salir del ancho móvil
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 991) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------
     Enlace activo según la sección visible
     ------------------------------------------------------------------ */
  function initScrollSpy() {
    var sections = $$('section[id]');
    var links = $$('.nav__link[data-spy]');
    if (!sections.length || !links.length) return;

    var byId = {};
    links.forEach(function (link) {
      var id = (link.getAttribute('href') || '').split('#')[1];
      if (id) byId[id] = link;
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = byId[entry.target.id];
        if (!link) return;
        links.forEach(function (l) { l.classList.remove('is-active'); });
        link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { if (byId[s.id]) observer.observe(s); });
  }

  /* ------------------------------------------------------------------
     Aparición progresiva de elementos

     Un único observador gobierna todas las animaciones de entrada. Además
     de los elementos con [data-reveal], activa los grupos que necesitan
     coordinarse: el gráfico del hero y la línea de la metodología.
     ------------------------------------------------------------------ */
  function initReveal() {
    var items = $$('[data-reveal], .reveal, .chart, .steps');
    if (!items.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-revealed', 'is-visible'); });
      return;
    }

    var observadorFunciona = false;

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observadorFunciona = true;
        entry.target.classList.add('is-revealed', 'is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el) {
      // Escalona automáticamente los hermanos de una misma rejilla
      if (!el.style.getPropertyValue('--reveal-delay') && el.parentNode) {
        var hermanos = Array.prototype.filter.call(
          el.parentNode.children,
          function (n) {
            return n.hasAttribute && (
              n.hasAttribute('data-reveal') ||
              (n.classList && n.classList.contains('reveal'))
            );
          }
        );
        var i = hermanos.indexOf(el);
        if (i > 0) el.style.setProperty('--reveal-delay', Math.min(i, 5) * 80 + 'ms');
      }
      observer.observe(el);
    });

    // Red de seguridad: comprobación única, no por elemento. El objetivo es
    // detectar un IntersectionObserver que no funciona en absoluto (algo
    // fundamentalmente roto), no sustituir el scroll — si funcionó para lo
    // que ya era visible al cargar, confiamos en que seguirá funcionando
    // para el resto según el usuario baje. Revelarlo todo aquí destruiría el
    // efecto de aparición progresiva en el resto de la página.
    setTimeout(function () {
      if (observadorFunciona) return;
      observer.disconnect();
      items.forEach(function (el) { el.classList.add('is-revealed', 'is-visible'); });
    }, 1400);
  }

  /* ------------------------------------------------------------------
     Titulares partidos en palabras

     Cada palabra sube desde detrás de una línea invisible. Se envuelve una
     palabra por <span> para no romper el ajuste de línea; el titular
     conserva su texto, así que los lectores de pantalla lo leen igual.
     ------------------------------------------------------------------ */
  function initSplitText() {
    var titulares = $$('[data-split]');
    if (!titulares.length || prefersReducedMotion) return;

    titulares.forEach(function (el) {
      if (el.dataset.splitDone === 'true') return;

      var indice = 0;

      // Recorre sólo los nodos de texto, para conservar <span>, <br>, etc.
      function partir(nodo) {
        Array.prototype.slice.call(nodo.childNodes).forEach(function (hijo) {
          if (hijo.nodeType === 3) {
            if (!hijo.textContent.trim()) return;

            var frag = document.createDocumentFragment();
            hijo.textContent.split(/(\s+)/).forEach(function (trozo) {
              if (!trozo) return;
              if (/^\s+$/.test(trozo)) {
                frag.appendChild(document.createTextNode(trozo));
                return;
              }
              var linea = document.createElement('span');
              linea.className = 'split-line';
              var palabra = document.createElement('span');
              palabra.className = 'split-word';
              palabra.style.setProperty('--word-index', indice++);
              palabra.textContent = trozo;
              linea.appendChild(palabra);
              frag.appendChild(linea);
            });
            nodo.replaceChild(frag, hijo);
          } else if (hijo.nodeType === 1 && !hijo.classList.contains('split-line')) {
            partir(hijo);
          }
        });
      }

      partir(el);
      el.dataset.splitDone = 'true';
      if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    });
  }

  /* ------------------------------------------------------------------
     Inclinación 3D y reflejo que siguen al puntero
     ------------------------------------------------------------------ */
  function initTilt() {
    if (prefersReducedMotion) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    $$('.tilt').forEach(function (el) {
      var brillo = document.createElement('span');
      brillo.className = 'tilt-shine';
      brillo.setAttribute('aria-hidden', 'true');
      el.appendChild(brillo);

      var raf = null, rx = 0, ry = 0, px = 50, py = 50;

      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        px = ((e.clientX - b.left) / b.width) * 100;
        py = ((e.clientY - b.top) / b.height) * 100;
        rx = (py / 100 - 0.5) * -7;
        ry = (px / 100 - 0.5) * 9;
        if (!raf) raf = requestAnimationFrame(pintar);
      });

      el.addEventListener('pointerenter', function () {
        el.classList.add('is-tilting');
      });

      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
        el.style.setProperty('--tilt-lift', '0px');
      });

      function pintar() {
        el.style.setProperty('--tilt-x', rx.toFixed(2) + 'deg');
        el.style.setProperty('--tilt-y', ry.toFixed(2) + 'deg');
        el.style.setProperty('--tilt-lift', '-6px');
        el.style.setProperty('--pointer-x', px.toFixed(1) + '%');
        el.style.setProperty('--pointer-y', py.toFixed(1) + '%');
        raf = null;
      }
    });
  }

  /* ------------------------------------------------------------------
     Botones magnéticos: el botón se acerca un poco al puntero
     ------------------------------------------------------------------ */
  function initMagnetic() {
    if (prefersReducedMotion) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    $$('[data-magnetic]').forEach(function (btn) {
      var raf = null, dx = 0, dy = 0;

      btn.addEventListener('pointermove', function (e) {
        var b = btn.getBoundingClientRect();
        dx = (e.clientX - (b.left + b.width / 2)) * 0.2;
        dy = (e.clientY - (b.top + b.height / 2)) * 0.26;
        if (!raf) {
          raf = requestAnimationFrame(function () {
            btn.style.setProperty('--magnet-x', dx.toFixed(1) + 'px');
            btn.style.setProperty('--magnet-y', dy.toFixed(1) + 'px');
            raf = null;
          });
        }
      });

      btn.addEventListener('pointerleave', function () {
        btn.style.setProperty('--magnet-x', '0px');
        btn.style.setProperty('--magnet-y', '0px');
      });
    });
  }

  /* ------------------------------------------------------------------
     El hero se aleja suavemente al bajar
     ------------------------------------------------------------------ */
  function initHeroScroll() {
    var hero = $('.hero');
    if (!hero || prefersReducedMotion) return;

    var contenido = $('.hero__content', hero);
    var visual = $('.hero__visual', hero);
    if (!contenido) return;

    var raf = null;

    function pintar() {
      var y = window.scrollY;
      var alto = hero.offsetHeight || 1;

      // El texto sólo empieza a desvanecerse cuando el hero ya va de salida
      // (a partir del 55% de su altura). Antes se atenuaba desde el primer
      // píxel de scroll y el texto quedaba ilegible con la sección a la vista.
      var inicio = alto * 0.55;
      var p = y <= inicio ? 0 : Math.min(1, (y - inicio) / (alto - inicio));

      contenido.style.transform = 'translate3d(0,' + (y * 0.08).toFixed(1) + 'px,0)';
      contenido.style.opacity = (1 - p * 0.85).toFixed(3);
      if (visual) visual.style.transform = 'translate3d(0,' + (y * 0.04).toFixed(1) + 'px,0)';

      raf = null;
    }

    window.addEventListener('scroll', function () {
      if (window.scrollY > hero.offsetHeight + 100) return;
      if (!raf) raf = requestAnimationFrame(pintar);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Contadores numéricos
     ------------------------------------------------------------------ */
  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      if (isNaN(target)) return;

      if (prefersReducedMotion) {
        el.textContent = target + suffix;
        return;
      }

      var duration = 1400;
      var start = null;

      function tick(now) {
        if (start === null) start = now;
        var p = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);

      // Si la animación no puede correr (pestaña en segundo plano, por
      // ejemplo), dejamos el valor final igualmente.
      setTimeout(function () {
        if (el.textContent !== target + suffix) el.textContent = target + suffix;
      }, duration + 400);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(run);
      return;
    }

    var started = [];

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || started.indexOf(entry.target) !== -1) return;
        started.push(entry.target);
        run(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });

    // Misma red de seguridad que en las animaciones de entrada
    setTimeout(function () {
      if (started.length) return;
      observer.disconnect();
      counters.forEach(run);
    }, 1400);
  }

  /* ------------------------------------------------------------------
     Parallax suave del hero según el puntero
     ------------------------------------------------------------------ */
  function initHeroParallax() {
    var hero = $('.hero');
    if (!hero || prefersReducedMotion) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    var orbs = $$('.hero__orb', hero);
    if (!orbs.length) return;

    var targetX = 0, targetY = 0, currentX = 0, currentY = 0, raf = null;

    hero.addEventListener('mousemove', function (e) {
      var rect = hero.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    });

    hero.addEventListener('mouseleave', function () {
      targetX = 0; targetY = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });

    function loop() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      orbs.forEach(function (orb, i) {
        var depth = (i + 1) * 14;
        orb.style.transform = 'translate3d(' + (currentX * depth) + 'px,' + (currentY * depth) + 'px,0)';
      });

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
  }

  /* ------------------------------------------------------------------
     Marquesina de logos: duplica el contenido para un bucle continuo
     ------------------------------------------------------------------ */
  function initMarquee() {
    $$('.marquee').forEach(function (marquee) {
      var track = $('.marquee__track', marquee);
      if (!track || track.dataset.cloned === 'true') return;

      var originals = Array.prototype.slice.call(track.children);
      if (!originals.length) return;

      originals.forEach(function (node) {
        var clone = node.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        // Los clones no deben ser alcanzables con el tabulador
        $$('a, button', clone).forEach(function (el) { el.setAttribute('tabindex', '-1'); });
        track.appendChild(clone);
      });

      track.dataset.cloned = 'true';

      // Velocidad constante independientemente de la cantidad de logos
      var speed = parseFloat(marquee.dataset.speed || '55'); // px por segundo
      var distance = track.scrollWidth / 2;
      track.style.setProperty('--marquee-duration', (distance / speed) + 's');
    });
  }

  /* ------------------------------------------------------------------
     Filtros animados (servicios y proyectos)

     Usa la técnica FLIP: se anota dónde está cada tarjeta (First), se
     aplica el filtro (Last), se calcula el desplazamiento (Invert) y se
     anima hasta su nueva posición (Play). Así las tarjetas que siguen
     visibles se deslizan a su sitio en vez de saltar, y la rejilla no da
     tirones al cambiar de altura.
     ------------------------------------------------------------------ */
  function initFilters() {
    $$('[data-filter-group]').forEach(function (grupo) {
      var contenedor = $(grupo.getAttribute('data-filter-group'));
      if (!contenedor) return;

      var botones = $$('.filter-btn', grupo);
      var items = $$('.grid-item', contenedor);
      var animando = false;

      function aplicar(filtro) {
        if (animando) return;
        animando = true;

        var puedeAnimar = !prefersReducedMotion && typeof Element.prototype.animate === 'function';

        // FIRST — posición actual de cada tarjeta visible
        var previas = new Map();
        if (puedeAnimar) {
          items.forEach(function (item) {
            if (!item.classList.contains('is-hidden')) {
              previas.set(item, item.getBoundingClientRect());
            }
          });
        }

        var altoPrevio = contenedor.offsetHeight;

        // LAST — aplicamos el filtro
        var entrantes = [];
        contenedor.classList.add('is-filtering');

        items.forEach(function (item) {
          var visible = filtro === '*' || item.classList.contains(filtro);
          var estabaOculto = item.classList.contains('is-hidden');

          item.classList.toggle('is-hidden', !visible);
          item.classList.remove('is-leaving', 'is-entering');

          if (visible && estabaOculto) entrantes.push(item);
        });

        // La rejilla acompaña el cambio de altura en lugar de saltar
        var altoNuevo = contenedor.offsetHeight;
        if (puedeAnimar && altoPrevio !== altoNuevo) {
          contenedor.animate(
            [{ height: altoPrevio + 'px' }, { height: altoNuevo + 'px' }],
            { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
          );
        }

        if (!puedeAnimar) {
          contenedor.classList.remove('is-filtering');
          animando = false;
          actualizarVacio();
          return;
        }

        // INVERT + PLAY — cada tarjeta se desliza desde donde estaba
        items.forEach(function (item) {
          if (item.classList.contains('is-hidden')) return;

          var antes = previas.get(item);
          var ahora = item.getBoundingClientRect();

          if (antes) {
            var dx = antes.left - ahora.left;
            var dy = antes.top - ahora.top;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
              item.animate(
                [
                  { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
                  { transform: 'none' }
                ],
                { duration: 480, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
              );
            }
          } else {
            // Tarjeta que aparece: entra con un fundido y una escala corta
            var retraso = entrantes.indexOf(item) * 55;
            item.animate(
              [
                { opacity: 0, transform: 'scale(0.92) translateY(16px)' },
                { opacity: 1, transform: 'none' }
              ],
              { duration: 460, delay: retraso, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
            );
          }
        });

        setTimeout(function () {
          contenedor.classList.remove('is-filtering');
          animando = false;
        }, 520);

        actualizarVacio();
      }

      function actualizarVacio() {
        var visibles = items.filter(function (i) { return !i.classList.contains('is-hidden'); }).length;
        var vacio = $('[data-filter-empty]', contenedor.parentNode);
        if (vacio) vacio.hidden = visibles > 0;
      }

      botones.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('is-active')) return;

          botones.forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
            b.setAttribute('aria-pressed', String(b === btn));
          });

          aplicar(btn.getAttribute('data-filter') || '*');
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     "Leer más" en las tarjetas de servicio
     ------------------------------------------------------------------ */
  function initReadMore() {
    $$('.card__more').forEach(function (btn) {
      var card = btn.closest('.service-card');
      if (!card) return;

      btn.addEventListener('click', function () {
        var expanded = card.classList.toggle('is-expanded');
        btn.setAttribute('aria-expanded', String(expanded));
        btn.querySelector('span').textContent = expanded ? 'Leer menos' : 'Leer más';
      });
    });
  }

  /* ------------------------------------------------------------------
     Visor de imágenes (lightbox) accesible
     ------------------------------------------------------------------ */
  function initLightbox() {
    var triggers = $$('[data-lightbox]');
    if (!triggers.length) return;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Visor de imágenes del proyecto');
    box.innerHTML =
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Cerrar visor">' +
        '<i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Imagen anterior">' +
        '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Imagen siguiente">' +
        '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>' +
      '<figure class="lightbox__figure">' +
        '<img alt="">' +
        '<figcaption class="lightbox__caption"></figcaption>' +
      '</figure>';
    document.body.appendChild(box);

    var img = $('img', box);
    var caption = $('.lightbox__caption', box);
    var index = 0;
    var lastFocused = null;

    function show(i) {
      index = (i + triggers.length) % triggers.length;
      var trigger = triggers[index];
      img.src = trigger.getAttribute('data-lightbox');
      img.alt = trigger.getAttribute('data-caption') || '';
      caption.textContent = trigger.getAttribute('data-caption') || '';
    }

    function open(i) {
      lastFocused = document.activeElement;
      show(i);
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      $('.lightbox__close', box).focus();
    }

    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }

    triggers.forEach(function (trigger, i) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        open(i);
      });
    });

    $('.lightbox__close', box).addEventListener('click', close);
    $('.lightbox__prev', box).addEventListener('click', function () { show(index - 1); });
    $('.lightbox__next', box).addEventListener('click', function () { show(index + 1); });

    box.addEventListener('click', function (e) {
      if (e.target === box) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'Tab') {
        // Mantiene el foco dentro del visor
        var focusables = $$('button', box);
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  }

  /* ------------------------------------------------------------------
     Botón "volver arriba"
     ------------------------------------------------------------------ */
  function initBackToTop() {
    var btn = $('.float-btn--top');
    if (!btn) return;

    window.addEventListener('scroll', function () {
      btn.classList.toggle('is-visible', window.scrollY > 500);
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------
     Formulario de contacto
     ------------------------------------------------------------------ */
  function initContactForm() {
    var form = $('#contact-form');
    if (!form) return;

    var status = $('#form-status');
    var submitBtn = $('button[type="submit"]', form);

    function setFieldError(field, message) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      var slot = $('.field__error', wrap);
      wrap.setAttribute('data-invalid', message ? 'true' : 'false');
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (slot) slot.textContent = message || '';
    }

    function validateField(field) {
      var value = (field.value || '').trim();

      if (field.required && !value) {
        setFieldError(field, 'Este campo es obligatorio.');
        return false;
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        setFieldError(field, 'Introduce un correo válido.');
        return false;
      }
      if (field.name === 'telefono' && value && !/^[\d\s()+.-]{7,20}$/.test(value)) {
        setFieldError(field, 'Introduce un teléfono válido.');
        return false;
      }
      if (field.name === 'mensaje' && value && value.length < 10) {
        setFieldError(field, 'Cuéntanos un poco más (mínimo 10 caracteres).');
        return false;
      }

      setFieldError(field, '');
      return true;
    }

    var fields = $$('input, textarea, select', form).filter(function (f) {
      return f.type !== 'submit' && !f.closest('.hp-field');
    });

    fields.forEach(function (field) {
      field.addEventListener('blur', function () { validateField(field); });
      field.addEventListener('input', function () {
        if (field.closest('.field').getAttribute('data-invalid') === 'true') validateField(field);
      });
    });

    function showStatus(state, message) {
      if (!status) return;
      status.setAttribute('data-state', state);
      status.textContent = message;
      status.classList.add('is-visible');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var valid = true;
      fields.forEach(function (field) {
        if (!validateField(field)) valid = false;
      });

      if (!valid) {
        showStatus('error', 'Revisa los campos marcados antes de enviar.');
        var firstBad = $('.field[data-invalid="true"] input, .field[data-invalid="true"] textarea, .field[data-invalid="true"] select', form);
        if (firstBad) firstBad.focus();
        return;
      }

      // Trampa antispam: si viene relleno, fingimos éxito y no enviamos nada
      var honey = $('input[name="website"]', form);
      if (honey && honey.value) {
        showStatus('ok', 'Mensaje enviado. Gracias por escribirnos.');
        form.reset();
        return;
      }

      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = value; });
      delete data.website;

      submitBtn.classList.add('btn--loading');
      submitBtn.setAttribute('aria-disabled', 'true');
      if (status) status.classList.remove('is-visible');

      var endpoint = form.getAttribute('data-endpoint') || '/api/contact';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().catch(function () { return { success: res.ok }; });
        })
        .then(function (payload) {
          if (payload && payload.success) {
            showStatus('ok', payload.message || 'Mensaje enviado. Te responderemos muy pronto.');
            form.reset();
            fields.forEach(function (f) { setFieldError(f, ''); });
          } else {
            throw new Error((payload && payload.message) || 'Error al enviar');
          }
        })
        .catch(function () {
          // Plan B: dejamos el mensaje listo por WhatsApp o correo
          var wa = form.getAttribute('data-whatsapp');
          var mailto = form.getAttribute('data-mailto');
          var link = '';

          if (wa) {
            var text = 'Hola On-Touch, soy de ' + (data.empresa || '') + '.\n' +
              'Asunto: ' + (data.asunto || '') + '\n' +
              (data.mensaje || '') + '\n' +
              'Contacto: ' + (data.email || '') + ' / ' + (data.telefono || '');
            link = ' <a href="https://wa.me/' + wa + '?text=' + encodeURIComponent(text) +
              '" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>';
          } else if (mailto) {
            link = ' <a href="mailto:' + mailto + '">Escríbenos por correo</a>';
          }

          showStatus('error', '');
          status.innerHTML = 'No pudimos enviar el mensaje en este momento.' + link;
          status.setAttribute('data-state', 'error');
          status.classList.add('is-visible');
        })
        .then(function () {
          submitBtn.classList.remove('btn--loading');
          submitBtn.removeAttribute('aria-disabled');
        });
    });
  }

  /* ------------------------------------------------------------------
     FAQ acordeón
     ------------------------------------------------------------------ */
  function initFaq() {
    $$('.faq-question').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq-item');
        if (!item) return;
        var open = item.classList.contains('is-open');
        var list = item.parentElement;
        if (list) {
          $$('.faq-item.is-open', list).forEach(function (el) {
            el.classList.remove('is-open');
            var b = $('.faq-question', el);
            if (b) b.setAttribute('aria-expanded', 'false');
          });
        }
        if (!open) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Mapa de cobertura: extrusión 3D, pines y parallax
     ------------------------------------------------------------------ */
  function initCoverageMap() {
    var root = document.getElementById('coverage-map');
    if (!root) return;

    var ns = 'http://www.w3.org/2000/svg';
    var extrude = $('.coverage__extrude', root);
    var country = $('.coverage__country', root);
    var island = $('.coverage__island', root);

    if (extrude && country) {
      var layers = 18;
      var step = 2;
      var frag = document.createDocumentFragment();

      function depth(s) {
        var t = (s - 1) / (layers - 1);
        return 'hsl(100, 58%, ' + (36 - t * 24).toFixed(1) + '%)';
      }

      var d = country.getAttribute('d');
      for (var i = layers; i >= 1; i--) {
        var p = document.createElementNS(ns, 'path');
        p.setAttribute('d', d);
        p.setAttribute('transform', 'translate(0 ' + i * step + ')');
        p.setAttribute('fill', depth(i));
        frag.appendChild(p);
      }

      if (island) {
        var iCx = island.getAttribute('cx');
        var iCy = parseFloat(island.getAttribute('cy')) || 0;
        var iRx = island.getAttribute('rx');
        var iRy = island.getAttribute('ry');
        for (var j = layers; j >= 1; j--) {
          var e = document.createElementNS(ns, 'ellipse');
          e.setAttribute('cx', iCx);
          e.setAttribute('cy', (iCy + j * step).toFixed(1));
          e.setAttribute('rx', iRx);
          e.setAttribute('ry', iRy);
          e.setAttribute('fill', depth(j));
          frag.appendChild(e);
        }
      }

      extrude.appendChild(frag);
    }

    var wrap = root.closest ? root.closest('.coverage__map-wrap') : null;
    if (wrap && !prefersReducedMotion &&
        window.matchMedia('(min-width: 901px) and (pointer: fine)').matches) {
      wrap.addEventListener('mousemove', function (ev) {
        var r = wrap.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width - 0.5;
        var py = (ev.clientY - r.top) / r.height - 0.5;
        root.style.setProperty('--tilt-x', (50 - py * 8).toFixed(1) + 'deg');
        root.style.setProperty('--tilt-z', (-14 + px * 10).toFixed(1) + 'deg');
      });
      wrap.addEventListener('mouseleave', function () {
        root.style.removeProperty('--tilt-x');
        root.style.removeProperty('--tilt-z');
      });
    }

    var pins = $$('.coverage__pin', root);
    var items = $$('.coverage__item');
    if (!pins.length || !items.length) return;

    function activate(name) {
      items.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-name') === name);
      });
      pins.forEach(function (pin) {
        pin.classList.toggle('is-active', pin.getAttribute('data-name') === name);
      });
    }

    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activate(btn.getAttribute('data-name'));
      });
    });

    pins.forEach(function (pin) {
      pin.addEventListener('click', function () {
        activate(pin.getAttribute('data-name'));
      });
    });

    var initial = items[0] && items[0].getAttribute('data-name');
    if (initial) activate(initial);
  }

  /* ------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------ */
  function init() {
    initYear();
    initHeader();
    initMobileNav();
    initScrollSpy();
    initSplitText();
    initReveal();
    initCounters();
    initTilt();
    initMagnetic();
    initHeroScroll();
    initHeroParallax();
    initMarquee();
    initFilters();
    initReadMore();
    initLightbox();
    initBackToTop();
    initContactForm();
    initFaq();
    initCoverageMap();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
