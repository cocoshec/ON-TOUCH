$(document).ready(function() {
    /* ================================ */
    /* Navigation & Smooth Scroll Area  */
    /* ================================ */

    // Navbar shrink on scroll + update active link
    $(window).on("scroll", function() {
        if ($(this).scrollTop() > 90) {
            $(".navbar").addClass("navbar-shrink");
        } else {
            $(".navbar").removeClass("navbar-shrink");
        }

        updateActiveLinkOnScroll();
    });

    // Parallax effect initialization
    function parallaxMouse() {
        if ($("#parallax").length) {
            var scene = document.getElementById("parallax");
            var parallax = new Parallax(scene);
        }
    }
    parallaxMouse();

    // Skills meter animation on scroll
    $(window).scroll(function() {
        var hT = $("#skill-bar-wrapper").offset().top;
        var hH = $("#skill-bar-wrapper").outerHeight();
        var wH = $(window).height();
        var wS = $(this).scrollTop();

        if (wS > (hT + hH - 1.4 * wH)) {
            jQuery('.skillbar-container').each(function() {
                jQuery(this).find('.skills').animate({
                    width: jQuery(this).attr('data-percent')
                }, 5000);
            });
        }
    });

    // Filter functionality for image gallery
    let $btns = $('.img-gallery .sortBtn .filter-btn');
    $btns.click(function(e) {
        $('.img-gallery .sortBtn .filter-btn').removeClass('active');
        e.target.classList.add('active');

        let selector = $(e.target).attr('data-filter');
        $('.img-gallery .grid').isotope({
            filter: selector
        });

        return false;
    });

    // Magnific Popup for image gallery
    $('.image-popup').magnificPopup({
        type: 'image',
        gallery: { enabled: true }
    });

    // Owl Carousel for testimonials slider
    $('.testimonial-slider').owlCarousel({
        loop: true,
        margin: 30,
        autoplay: true,
        responsiveClass: true,
        responsive: {
            0: { items: 1 },
            600: { items: 2 },
            1000: { items: 3 }
        }
    });

    /* ------------------------------ */
    /* Smooth scroll helper - versión nativa y rápida
       - usa window.scrollTo({behavior:'smooth'})
       - soporta href strings ('#id') y jQuery objects
    */
    function smoothScrollToSection(target) {
        var navbarHeight = $('.navbar').outerHeight() || 0;

        var targetPosition = 0;

        if (!target) {
            targetPosition = 0;
        } else if (typeof target === 'string') {
            var hashIndex = target.indexOf('#');
            var selector = (hashIndex >= 0) ? target.slice(hashIndex) : target;
            if (selector === '#' || selector === '') {
                targetPosition = 0;
            } else if ($(selector).length) {
                targetPosition = Math.max(0, $(selector).offset().top - navbarHeight + 1);
            }
        } else if (target instanceof jQuery && target.length) {
            targetPosition = Math.max(0, target.offset().top - navbarHeight + 1);
        }

        // Use native smooth scrolling for better performance
        try {
            window.scrollTo({ top: Math.floor(targetPosition), behavior: 'smooth' });
        } catch (e) {
            // Fallback to jQuery animate if not supported
            $('html, body').stop(true, false).animate({ scrollTop: targetPosition }, 500);
        }

        // Trigger an active-link update shortly after scroll starts
        setTimeout(updateActiveLinkOnScroll, 100);

        return false;
    }

    /* ------------------------------ */
    /* Active link update
       - calcula la sección visible teniendo en cuenta el navbar fijo
    */
    function updateActiveLinkOnScroll() {
        var navbarHeight = $('.navbar').outerHeight() || 0;
        var scrollCenter = $(window).scrollTop() + navbarHeight + ($(window).height() / 6);

        var found = false;
        $('section[data-scroll-index]').each(function() {
            var $s = $(this);
            var top = $s.offset().top;
            var bottom = top + $s.outerHeight();

            if (scrollCenter >= top && scrollCenter < bottom) {
                var idx = $s.attr('data-scroll-index');
                $('.navbar-nav .nav-link').removeClass('active');
                // Support links that use data-scroll-nav or href anchors
                var $link = $('.navbar-nav .nav-link[data-scroll-nav="' + idx + '"]');
                if ($link.length) {
                    $link.addClass('active');
                } else {
                    // Try to match by href -> '#id'
                    var id = $s.attr('id');
                    if (id) {
                        $('.navbar-nav .nav-link[href$="#' + id + '"]').addClass('active');
                    }
                }
                // Guardar la última sección visible para poder volver desde páginas externas
                var visibleId = $s.attr('id');
                if (visibleId) {
                    try { localStorage.setItem('onTouchLastSection', '#' + visibleId); } catch (e) { /* no-op */ }
                }
                found = true;
                return false; // break each
            }
        });

        if (!found) {
                // If nothing found by data-scroll-index, try to match by URL hash or filename
                $('.navbar-nav .nav-link').removeClass('active');
                var matched = false;
                try {
                    var locHash = window.location.hash || '';
                    var currentFile = window.location.pathname.split('/').pop() || '';

                    // 1) If URL has a hash, try to match nav link ending with that hash
                    if (locHash) {
                        var $byHash = $('.navbar-nav .nav-link[href$="' + locHash + '"]');
                        if ($byHash.length) { $byHash.first().addClass('active'); matched = true; }
                    }

                    // 2) If no hash match, try matching by current filename (e.g., 'proyectos.html')
                    if (!matched && currentFile) {
                        var $byFile = $('.navbar-nav .nav-link[href$="' + currentFile + '"]');
                        if ($byFile.length) { $byFile.first().addClass('active'); matched = true; }
                    }
                } catch (e) { matched = false; }

                // 3) Fallback: activate the first nav link (usually Inicio)
                if (!matched) {
                    var $first = $('.navbar-nav .nav-link').first();
                    if ($first.length) $first.addClass('active');
                }
        }
    }

    // Handle nav link clicks (supports href anchors, data-scroll-nav and external page links)
    $('.navbar-nav .nav-link').on('click', function(e) {
        var $a = $(this);
        var href = ($a.attr('href') || '').trim();

        // If link explicitly points to the site's index with a hash (e.g. "index.html#about"), allow full navigation
        if (href.indexOf('index.html') !== -1) {
            $('.navbar-collapse').collapse('hide');
            window.location.href = href;
            return;
        }

        // If link points to another page (no hash and not a data-scroll-nav), navigate there
        if (href.indexOf('#') === -1 && !$a.is('[data-scroll-nav]') && href !== '') {
            $('.navbar-collapse').collapse('hide');
            window.location.href = href;
            return;
        }

        e.preventDefault();

        // Determine target: prefer href anchor, fallback to data-scroll-nav
        var target = null;
        if (href.indexOf('#') >= 0) {
            target = href.substring(href.indexOf('#')) || '#';
        } else if ($a.is('[data-scroll-nav]')) {
            var idx = $a.attr('data-scroll-nav');
            target = $('section[data-scroll-index="' + idx + '"]');
        }

        // Update active link immediately
        $('.navbar-nav .nav-link').removeClass('active');
        $a.addClass('active');

        // Si el usuario hizo clic en un enlace de navegación dentro de la misma página, guardar esa sección
        try {
            if (typeof target === 'string' && target.indexOf('#') === 0) {
                localStorage.setItem('onTouchLastSection', target);
            } else if (target instanceof jQuery && target.length) {
                var tid = target.attr('id');
                if (tid) localStorage.setItem('onTouchLastSection', '#' + tid);
            }
        } catch (e) { /* no-op */ }

        // Collapse mobile menu if open
        $('.navbar-collapse').collapse('hide');

        // Smooth scroll to section
        smoothScrollToSection(target);
    });

    // Handle "Observa nuestros proyectos" button
    $('.btn-1[data-scroll-nav]').on('click', function(e) {
        e.preventDefault();
        var targetId = $(this).attr('href');
        smoothScrollToSection(targetId);
    });

    // Handle "Contacto" button in about section
    $('.hire-me[data-scroll-nav]').on('click', function(e) {
        e.preventDefault();
        var targetId = $(this).attr('href');
        smoothScrollToSection(targetId);
    });

    // Initialize active link on page load
    updateActiveLinkOnScroll();

    // Si la página se cargó con un hash (ej. index.html#contact), hacer scroll automático a esa sección
    try {
        var initialHash = window.location.hash || '';
        if (initialHash) {
            setTimeout(function() {
                if ($(initialHash).length) {
                    smoothScrollToSection(initialHash);
                }
            }, 60);
        }
    } catch (e) { /* no-op */ }

    // Hiding Mobile Navbar when a nav link is clicked
    $(".nav-link").on("click", function() {
        $(".navbar-collapse").collapse("hide");
    });

    // Initialize Bootstrap carousel for services section
    $('#servicesCarousel').carousel({
        interval: 5000
    });

    // Inicializar Owl Carousel en cada carrusel de proyectos
    $('.project-slider').each(function() {
        $(this).owlCarousel({
            loop: true,
            margin: 20,
            nav: true,
            dots: true,
            autoplay: true,
            autoplayTimeout: 3000,
            autoplayHoverPause: true,
            responsive: {
                0: { items: 1 },
                600: { items: 2 },
                1000: { items: 3 }
            }
        });

        $(this).find('.image-popup').magnificPopup({
            type: 'image',
            gallery: {
                enabled: true,
                navigateByImgClick: true,
                preload: [0, 1]
            },
            callbacks: {
                beforeOpen: function() {
                    var currentCarousel = $(this.items[0]).closest('.project-slider');
                    this.st.gallery.group = currentCarousel.find('.image-popup').map(function() {
                        return { src: $(this).attr('href') };
                    }).get();
                }
            }
        });
    });
});
