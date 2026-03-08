document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Firebase
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Emuladores (si estás en local)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        db.useEmulator("localhost", 8080);
        storage.useEmulator("localhost", 9199);
    }

    const challengeTextElement = document.getElementById('challenge-text');
    const uploadSection = document.getElementById('challenge-upload-section');
    const photoInput = document.getElementById('challenge-photo');
    const selectPhotoBtn = document.getElementById('select-photo-btn');
    const confirmBtn = document.getElementById('confirm-upload-btn');
    const previewContainer = document.getElementById('preview-container');

    const params = new URLSearchParams(window.location.search);
    const reto = params.get('reto');
    const guestName = params.get('name');

    if (challengeTextElement) {
        if (reto) {
            challengeTextElement.innerHTML = reto.replace(/\n/g, '<br><br>');
            if (uploadSection) uploadSection.style.display = 'block';
        } else {
            challengeTextElement.textContent = 'Parece que no hay ningún reto asignado. ¡Disfruta de la fiesta!';
            if (uploadSection) uploadSection.style.display = 'none';
        }
    }

    // --- Lógica de subida de foto ---
    let selectedFile = null;

    selectPhotoBtn.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            selectedFile = e.target.files[0];
            
            // Mostrar vista previa
            const reader = new FileReader();
            reader.onload = (ev) => {
                previewContainer.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                confirmBtn.style.display = 'inline-block';
                selectPhotoBtn.textContent = 'Cambiar foto';
            };
            reader.readAsDataURL(selectedFile);
        }
    });

    confirmBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        if (!guestName) {
            alert("No se ha podido identificar tu nombre. Vuelve a intentarlo desde el inicio.");
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Subiendo...';

        try {
            // 1. Subir foto a Storage
            // SOLUCIÓN: Usamos la carpeta 'memories' que ya tiene permisos de escritura públicos.
            const filePath = `memories/${Date.now()}_challenge_${selectedFile.name}`;
            const fileRef = storage.ref().child(filePath);
            await fileRef.put(selectedFile);
            const downloadURL = await fileRef.getDownloadURL();

            // 2. Guardar en Firestore como un nuevo recuerdo especial
            await db.collection('memories').add({
                guestName: guestName,
                messageHTML: `<strong>¡Reto completado!</strong><br><br><em>${reto.replace(/\n/g, ' ')}</em>`,
                imageUrls: [downloadURL],
                challenge: reto,
                isChallengeProof: true, // Marca especial para identificarlo
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('¡Prueba subida con éxito! Eres un crack.');
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Error al subir prueba:", error);
            alert('Hubo un error al subir la foto. Inténtalo de nuevo.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Enviar Prueba';
        }
    });
});