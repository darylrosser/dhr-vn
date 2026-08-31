(function () {
    function initNavMobile() {
        var toggle = document.querySelector('.nav-toggle');
        var closeBtn = document.querySelector('.nav-close');
        var nav = document.querySelector('.site-nav');

        if (!toggle || !closeBtn || !nav) return;

        var scrollY = 0;

        function openNav() {
            scrollY = window.scrollY || window.pageYOffset;
            document.documentElement.classList.add('nav-open');
            document.body.classList.add('nav-open');
            toggle.setAttribute('aria-expanded', 'true');
            nav.setAttribute('aria-hidden', 'false');
        }

        function closeNav() {
            document.documentElement.classList.remove('nav-open');
            document.body.classList.remove('nav-open');
            toggle.setAttribute('aria-expanded', 'false');
            nav.setAttribute('aria-hidden', 'true');
            if (scrollY) window.scrollTo(0, scrollY);
        }

        toggle.addEventListener('click', function () {
            if (document.body.classList.contains('nav-open')) {
                closeNav();
            } else {
                openNav();
            }
        });

        closeBtn.addEventListener('click', closeNav);

        nav.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', closeNav);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavMobile);
    } else {
        initNavMobile();
    }
})();
