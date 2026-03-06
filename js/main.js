document.addEventListener('DOMContentLoaded', () => {
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
    const applyStyle = (command, value = null) => {
        document.execCommand(command, false, value);
        messageBox.focus();
    };

    fontNameSelect.addEventListener('change', () => applyStyle('fontName', fontNameSelect.value));
    fontSizeSelect.addEventListener('change', () => applyStyle('fontSize', fontSizeSelect.value));
    fontColorInput.addEventListener('input', () => applyStyle('foreColor', fontColorInput.value));

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
        if (!guestName.trim() || (!messageHTML.trim() && selectedFiles.length === 0)) {
            alert('Por favor, escribe un mensaje o sube una foto.');
            return;
        }

        const submitButton = memoryForm.querySelector('.submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        // --- INICIO: CÓDIGO DE SIMULACIÓN (BORRAR AL USAR FIREBASE) ---
        setTimeout(() => {
            console.log("--- ENVIANDO RECUERDO (SIMULACIÓN) ---");
            console.log("Nombre:", guestName);
            console.log("Mensaje (HTML):", messageHTML);
            if (selectedFiles.length > 0) {
                console.log("Archivos de imagen:", selectedFiles.map(f => f.name));
            }
            alert('¡Gracias por tu recuerdo! (Esto es una simulación. Revisa la consola para ver los datos).');
            
            guestNameInput.value = '';
            messageBox.innerHTML = '';
            imagePreview.innerHTML = '';
            selectedFiles = [];
            
            card.classList.remove('is-flipped');
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar Recuerdo';
        }, 1500);
        // --- FIN: CÓDIGO DE SIMULACIÓN ---

        // --- INICIO: LÓGICA REAL DE FIREBASE (DESCOMENTAR CUANDO ESTÉ CONFIGURADO) ---
        /*
        const saveMemory = async () => {
            try {
                let imageUrls = [];
                if (selectedFiles.length > 0) {
                    const uploadPromises = selectedFiles.map(file => {
                        const filePath = `memories/${Date.now()}_${file.name}`;
                        const fileRef = storage.ref().child(filePath);
                        // Devolvemos la promesa de subida que se resuelve con la URL
                        return fileRef.put(file).then(() => fileRef.getDownloadURL());
                    });
                    // Esperamos a que todas las subidas terminen
                    imageUrls = await Promise.all(uploadPromises);
                }
                const memoryData = {
                    guestName: guestName,
                    messageHTML: messageHTML,
                    imageUrls: imageUrls, // Guardamos un array de URLs
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('memories').add(memoryData);
                alert('¡Recuerdo guardado con éxito!');
                // Limpiar y volver...
            } catch (error) {
                console.error("Error al guardar el recuerdo: ", error);
                alert('Hubo un error al guardar tu recuerdo.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Recuerdo';
            }
        };
        saveMemory();
        */
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