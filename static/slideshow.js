'use strict';

(() => {
    const hero = document.querySelector('.landing-hero');
    if (!hero) return;

    const photos = [...hero.querySelectorAll('.hero-photo')];
    const steps = [...hero.querySelectorAll('.photo-step')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let inView = true;
    let timer;
    let selectionVersion = 0;

    function canRotate() {
        return !reducedMotion.matches && !document.hidden && inView && !document.querySelector('dialog[open]');
    }

    function schedule() {
        clearTimeout(timer);
        if (!canRotate()) return;
        timer = setTimeout(() => select((current + 1) % photos.length, true), 6500);
    }

    async function select(index, automatic = false) {
        clearTimeout(timer);
        const version = ++selectionVersion;
        // Keep the current image visible until the next one is ready.
        try {
            await photos[index].decode();
        } catch {
            schedule();
            return;
        }
        if (version !== selectionVersion || (automatic && !canRotate())) return;
        current = index;
        photos.forEach((photo, number) => photo.classList.toggle('is-active', number === index));
        steps.forEach((step, number) => {
            step.classList.toggle('is-active', number === index);
            step.setAttribute('aria-pressed', String(number === index));
        });
        schedule();
    }

    steps.forEach((step, index) => step.addEventListener('click', () => select(index)));
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', schedule);
    new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        schedule();
    }).observe(hero);
    const dialogs = new MutationObserver(schedule);
    document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, {
        attributes: true,
        attributeFilter: ['open']
    }));

    hero.querySelector('.photo-steps').hidden = false;
    schedule();
})();
