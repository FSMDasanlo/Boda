document.addEventListener('DOMContentLoaded', () => {
    const weddingInfo = document.querySelector('.wedding-info');
    const card = document.querySelector('.card');
    const flipButton = document.querySelector('.memory-button');
    const backButton = document.querySelector('.back-button');

    if (!weddingInfo || !card || !flipButton || !backButton) {
        console.error('Alguno de los elementos necesarios para la animación no se encontró.');
        return;
    }

    // --- Lógica para girar la tarjeta ---
    const flipCard = (event) => {
        event.preventDefault(); // Evita que el enlace '#' recargue la página
        card.classList.toggle('is-flipped');
    };

    flipButton.addEventListener('click', flipCard);
    backButton.addEventListener('click', flipCard);


    // --- Lógica para cambiar el idioma del texto inferior ---
    // Los tiempos se basan en los 'animation-delay' del CSS.
    // Cada animación de palabra dura 1s.

    // 1s: Empieza 'Welcome' -> Cambiar a Inglés
    setTimeout(() => {
        weddingInfo.classList.add('lang-en');
    }, 1000);

    // 2s: Empieza 'Bienvenue' -> Cambiar a Español
    setTimeout(() => {
        weddingInfo.classList.remove('lang-en');
    }, 2000);

    // 3s: Empieza 'Willkommen' -> Cambiar a Inglés
    setTimeout(() => {
        weddingInfo.classList.add('lang-en');
    }, 3000);

    // 4s: Empieza 'Benvenuti' -> Cambiar a Español
    setTimeout(() => {
        weddingInfo.classList.remove('lang-en');
    }, 4000);
});