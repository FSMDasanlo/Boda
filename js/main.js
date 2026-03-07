document.addEventListener('DOMContentLoaded', () => {
    // Firebase se inicializa automáticamente gracias a /__/firebase/init.js
    // cuando el sitio está desplegado en Firebase Hosting.
    const db = firebase.firestore(); // Ahora puedes usar firebase directamente

    const storage = firebase.storage(); // Y también storage
    
    // --- Conectar a Emuladores si se está en entorno local ---
    // Esto permite probar en tu PC sin tocar la base de datos real
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        console.log("Entorno local detectado. Usando emuladores.");
        db.useEmulator("localhost", 8080);
        storage.useEmulator("localhost", 9199);
    }

    // --- Selectores de elementos ---
    const weddingInfo = document.querySelector('.wedding-info');
    const card = document.querySelector('.card');
    const flipButton = document.querySelector('.memory-button');
    const backButton = document.querySelector('.back-button');
    
    // Elementos del formulario
    const memoryForm = document.getElementById('memory-form');
    const guestNameInput = document.getElementById('guest-name');
    const messageBox = document.getElementById('message-box');
    const fontNameSelect = document.getElementById('font-name');
    const fontSizeSelect = document.getElementById('font-size');
    const fontColorInput = document.getElementById('font-color');
    const uploadPhotoButton = document.getElementById('upload-photo-button');
    const photoUploadInput = document.getElementById('photo-upload');
    const imagePreview = document.getElementById('image-preview-container');
    const charCounter = document.getElementById('char-counter');
    const confirmationMessage = document.getElementById('confirmation-message');

    if (!card || !flipButton || !backButton || !memoryForm) {
        console.error('Alguno de los elementos principales no se encontró.');
        return;
    }

    // --- Lógica para girar la tarjeta ---
    const flipCard = (event) => {
        event.preventDefault();
        card.classList.toggle('is-flipped');
    };
    flipButton.addEventListener('click', flipCard);
    backButton.addEventListener('click', flipCard);

    // --- Lógica del editor de texto ---
    // Establece el color inicial del texto al cargar la página, tomando el valor del input
    messageBox.style.color = fontColorInput.value;

    const applyStyle = (command, value = null) => {
        document.execCommand(command, false, value);
        messageBox.focus();
    };

    fontNameSelect.addEventListener('change', () => applyStyle('fontName', fontNameSelect.value));
    fontSizeSelect.addEventListener('change', () => applyStyle('fontSize', fontSizeSelect.value));
    fontColorInput.addEventListener('input', () => applyStyle('foreColor', fontColorInput.value));

    // --- Lógica del contador de caracteres ---
    const MAX_CHARS = 500;
    charCounter.textContent = `0 / ${MAX_CHARS}`; // Inicializar

    messageBox.addEventListener('input', () => {
        const currentLength = messageBox.innerText.length;
        
        charCounter.textContent = `${currentLength} / ${MAX_CHARS}`;

        if (currentLength > MAX_CHARS) {
            charCounter.style.color = '#ff4d4d'; // Rojo para indicar que se pasó
        } else {
            charCounter.style.color = 'rgba(255, 255, 255, 0.7)';
        }
    });

    // --- Lógica para subir foto ---
    let selectedFiles = [];
    uploadPhotoButton.addEventListener('click', () => {
        photoUploadInput.click(); // Abre el diálogo de archivo
    });

    photoUploadInput.addEventListener('change', (event) => {
        const newFiles = Array.from(event.target.files);
        if (selectedFiles.length + newFiles.length > 5) {
            alert('Puedes subir un máximo de 5 fotos.');
            // Limpiamos el input para que el evento 'change' se dispare si eligen los mismos archivos de nuevo
            photoUploadInput.value = null;
            return;
        }

        newFiles.forEach(file => {
            // Añadimos el archivo a nuestro array
            selectedFiles.push(file);

            // Creamos la vista previa
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.classList.add('image-preview-item');
                previewItem.style.backgroundImage = `url(${e.target.result})`;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.classList.add('remove-image-btn');
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => {
                    previewItem.remove();
                    const index = selectedFiles.indexOf(file);
                    if (index > -1) {
                        selectedFiles.splice(index, 1);
                    }
                };

                previewItem.appendChild(removeBtn);
                imagePreview.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
        photoUploadInput.value = null;
    });

    // --- Lógica de envío a Firebase ---
    memoryForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const guestName = guestNameInput.value;
        const messageHTML = messageBox.innerHTML;

        // Validación extra: Límite de caracteres
        if (messageBox.innerText.length > MAX_CHARS) {
            alert(`Tu mensaje es demasiado largo. El límite es de ${MAX_CHARS} caracteres.`);
            submitButton.disabled = false; // Reactivar botón
            submitButton.textContent = 'Enviar Recuerdo';
            messageBox.focus();
            return;
        }

        // Validación 1: Nombre del invitado no puede estar vacío
        if (!guestName.trim()) {
            alert('Por favor, no te olvides de poner tu nombre.');
            guestNameInput.focus(); // Pone el foco en el campo del nombre
            return;
        }

        // Validación 2: Debe haber un mensaje o una foto
        if (!messageHTML.trim() && selectedFiles.length === 0) {
            alert('Por favor, escribe un mensaje o sube una foto.');
            messageBox.focus(); // Pone el foco en el campo del mensaje
            return;
        }

        const submitButton = memoryForm.querySelector('.submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        // --- INICIO: LÓGICA REAL DE FIREBASE ---
        const saveMemory = async () => {
            try {
                // 1. Subir imágenes a Firebase Storage si existen
                let imageUrls = [];
                if (selectedFiles.length > 0) {
                    const uploadPromises = selectedFiles.map(file => {
                        const filePath = `memories/${Date.now()}_${file.name}`;
                        const fileRef = storage.ref().child(filePath);
                        return fileRef.put(file).then(() => fileRef.getDownloadURL());
                    });
                    imageUrls = await Promise.all(uploadPromises);
                }

                // 2. Guardar los datos en Firestore
                const memoryData = {
                    guestName: guestName,
                    messageHTML: messageHTML,
                    imageUrls: imageUrls,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('memories').add(memoryData);

                // 3. Mostrar animación de éxito y resetear el formulario
                confirmationMessage.classList.add('show');

                setTimeout(() => {
                    confirmationMessage.classList.remove('show');
                    guestNameInput.value = '';
                    messageBox.innerHTML = '';
                    imagePreview.innerHTML = '';
                    selectedFiles = [];
                    charCounter.textContent = `0 / ${MAX_CHARS}`;
                    card.classList.remove('is-flipped');
                    // Reactivamos el botón al final de la animación de vuelta
                    submitButton.disabled = false;
                    submitButton.textContent = 'Enviar Recuerdo';
                }, 2000);

            } catch (error) {
                console.error("Error al guardar el recuerdo: ", error);
                alert('Hubo un error al guardar tu recuerdo. Por favor, inténtalo de nuevo.');
                // En caso de error, también reactivamos el botón
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Recuerdo';
            }
        };

        saveMemory();
        // --- FIN: LÓGICA REAL DE FIREBASE ---
    });

    // --- Lógica para cambiar el idioma del texto inferior ---
    // Los tiempos se basan en los 'animation-delay' del CSS.
    // Cada animación de palabra dura 1s.
    if (weddingInfo) {
        setTimeout(() => { weddingInfo.classList.add('lang-en'); }, 1000);
        setTimeout(() => { weddingInfo.classList.remove('lang-en'); }, 2000);
        setTimeout(() => { weddingInfo.classList.add('lang-en'); }, 3000);
        setTimeout(() => { weddingInfo.classList.remove('lang-en'); }, 4000);
    }
});