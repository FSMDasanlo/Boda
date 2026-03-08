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
    const boldButton = document.getElementById('bold-btn');
    const italicButton = document.getElementById('italic-btn');
    const fontColorInput = document.getElementById('font-color');
    const uploadPhotoButton = document.getElementById('upload-photo-button');
    const photoUploadInput = document.getElementById('photo-upload');
    const imagePreview = document.getElementById('image-preview-container');
    const charCounter = document.getElementById('char-counter');
    const confirmationMessage = document.getElementById('confirmation-message');

    let challenges = []; // Se rellenará desde Firestore

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

    boldButton.addEventListener('click', () => applyStyle('bold'));
    italicButton.addEventListener('click', () => applyStyle('italic'));
    fontNameSelect.addEventListener('change', () => applyStyle('fontName', fontNameSelect.value));
    fontSizeSelect.addEventListener('change', () => applyStyle('fontSize', fontSizeSelect.value));

    // Manejo del color: Aplicar solo a selección o nuevo texto
    fontColorInput.addEventListener('input', () => {
        const newColor = fontColorInput.value;
        applyStyle('foreColor', newColor);
    });

    // Sincronización inversa: Actualizar el selector de color según donde esté el cursor
    const updateColorPicker = () => {
        const color = document.queryCommandValue('foreColor');
        // Convertir rgb(r, g, b) a hex #RRGGBB para que el input lo entienda
        if (color && color.indexOf('rgb') !== -1) {
            const rgb = color.match(/\d+/g);
            if (rgb) {
                const hex = "#" + 
                    ("0" + parseInt(rgb[0], 10).toString(16)).slice(-2) +
                    ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
                    ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2);
                fontColorInput.value = hex;
            }
        }
    };
    messageBox.addEventListener('keyup', updateColorPicker);
    messageBox.addEventListener('mouseup', updateColorPicker);

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

    // --- Lógica de envío a Firebase (mejorada) ---
    const saveMemory = async (guestName, messageHTML, files, challenge = null) => {
        // 1. Subir imágenes a Firebase Storage si existen
        let imageUrls = [];
        if (files.length > 0) {
            const uploadPromises = files.map(file => {
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        if (challenge) {
            memoryData.challenge = challenge;
        }

        await db.collection('memories').add(memoryData);
    };

    // Función para escapar HTML y evitar XSS
    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    // Helper para resetear el formulario
    const resetForm = (enableButton = true) => {
        const submitButton = memoryForm.querySelector('.submit-button');
        guestNameInput.value = '';
        messageBox.innerHTML = '';
        imagePreview.innerHTML = '';
        selectedFiles = [];
        charCounter.textContent = `0 / ${MAX_CHARS}`;
        charCounter.style.color = 'rgba(255, 255, 255, 0.7)';
        if (enableButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar Recuerdo';
        }
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        
        const guestName = guestNameInput.value;
        const messageHTML = messageBox.innerHTML;
        const filesToUpload = [...selectedFiles]; // Copia para procesar en segundo plano
        
        const submitButton = memoryForm.querySelector('.submit-button');

        // --- Validaciones ---
        if (messageBox.innerText.length > MAX_CHARS) {
            alert(`Tu mensaje es demasiado largo. El límite es de ${MAX_CHARS} caracteres.`);
            messageBox.focus();
            return;
        }
        if (!guestName.trim()) {
            alert('Por favor, no te olvides de poner tu nombre.');
            guestNameInput.focus();
            return;
        }
        if (!messageHTML.trim() && filesToUpload.length === 0) {
            alert('Por favor, escribe un mensaje o sube una foto.');
            messageBox.focus();
            return;
        }

        submitButton.disabled = true;

        // FEEDBACK INMEDIATO: Mostrar "Procesando" antes de saber si hay reto
        confirmationMessage.innerHTML = `
            <div class="confirmation-icon-loading"></div>
            <h2>Procesando...</h2>
        `;
        confirmationMessage.classList.add('show');

        try {
            // 1. Obtener el número actual de recuerdos para mostrar un mensaje personalizado
            const snapshot = await db.collection('memories').get();
            const count = snapshot.size;
            const newCount = count + 1;

            // Determinar si hay un reto antes de guardar
            let challenge = null;
            if (newCount % 5 === 0) {
                const challengeIndex = (newCount / 5) - 1;
                challenge = challenges[challengeIndex % challenges.length];
            }

            // 2. Actualizar mensaje de carga: Si hay reto, lo decimos YA.
            const friendlyGuestName = escapeHtml(guestName.trim().split(' ')[0]);
            
            if (challenge) {
                confirmationMessage.innerHTML = `
                    <div class="confirmation-icon-loading"></div>
                    <h2>¡SORPRESA, ${friendlyGuestName}!</h2>
                    <p>Eres el invitado n.º ${newCount} y...</p>
                    <p style="font-size: 1.5em; font-weight: bold; color: #f0e68c; margin: 10px 0;">¡TIENES UN RETO!</p>
                    <p class="sending-info">Guardando tu mensaje para ver el reto...</p>
                `;
            } else {
                confirmationMessage.innerHTML = `
                    <div class="confirmation-icon-loading"></div>
                    <h2>¡Gracias, ${friendlyGuestName}!</h2>
                    <p>Eres la persona n.º ${newCount} en dejarnos un recuerdo.</p>
                    <p class="sending-info">Guardando ${filesToUpload.length > 0 ? `tus ${filesToUpload.length} foto(s) y ` : ''}tu mensaje...</p>
                `;
            }

            // 3. Iniciar el guardado en segundo plano y un temporizador mínimo de 2 segundos.
            // Esto asegura que el mensaje de "Gracias" se vea al menos ese tiempo.
            const savePromise = saveMemory(guestName, messageHTML, filesToUpload, challenge);
            const timerPromise = new Promise(resolve => setTimeout(resolve, 2000));

            await Promise.all([savePromise, timerPromise]);

            // 4. Cuando el guardado y el tiempo mínimo han pasado, decidir si hay reto o no
            if (challenge) {
                const encodedChallenge = encodeURIComponent(challenge);
                const encodedName = encodeURIComponent(guestName);

                confirmationMessage.innerHTML = `
                    <div class="confirmation-icon" style="color: #f0e68c;">&#11088;</div>
                    <h2>¡Recuerdo guardado!</h2>
                    <p>Y por ser el recuerdo n.º ${newCount}... ¡tienes un reto!</p>
                    <button type="button" class="submit-button" style="margin-top: 20px;" onclick="window.location.href='retos.html?reto=${encodedChallenge}&name=${encodedName}'">Ver mi reto</button>
                `;
                const icon = confirmationMessage.querySelector('.confirmation-icon');
                if (icon) icon.style.animation = 'pop-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards';

                // Reseteamos el formulario en segundo plano, pero no el botón.
                resetForm(false);

            } else {
                // Flujo normal sin reto
                confirmationMessage.innerHTML = `
                    <div class="confirmation-icon">&#10004;</div>
                    <h2>¡Recuerdo guardado!</h2>
                    <p>Gracias por formar parte de nuestro día.</p>
                `;
                const icon = confirmationMessage.querySelector('.confirmation-icon');
                if (icon) icon.style.animation = 'pop-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards';

                // 5. Resetear el formulario y volver a la cara principal
                setTimeout(() => {
                    confirmationMessage.classList.remove('show');
                    resetForm(true);
                    card.classList.remove('is-flipped');
                }, 3000);
            }

        } catch (error) {
            console.error("Error al guardar el recuerdo: ", error);
            
            confirmationMessage.innerHTML = `
                <div class="confirmation-icon" style="color: #ff4d4d;">&times;</div>
                <h2>¡Ups! Hubo un error</h2>
                <p>No se pudo guardar tu recuerdo. Por favor, inténtalo de nuevo en un momento.</p>
            `;
            const errorIcon = confirmationMessage.querySelector('.confirmation-icon');
            if (errorIcon) errorIcon.style.animation = 'pop-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards';

            setTimeout(() => {
                confirmationMessage.classList.remove('show');
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Recuerdo';
            }, 5000);
        }
    };

    // --- Lógica para cambiar el idioma del texto inferior ---
    // Los tiempos se basan en los 'animation-delay' del CSS.
    // Cada animación de palabra dura 1s.
    if (weddingInfo) {
        setTimeout(() => { weddingInfo.classList.add('lang-en'); }, 1000);
        setTimeout(() => { weddingInfo.classList.remove('lang-en'); }, 2000);
        setTimeout(() => { weddingInfo.classList.add('lang-en'); }, 3000);
        setTimeout(() => { weddingInfo.classList.remove('lang-en'); }, 4000);
    }

    // --- Carga inicial de datos y asignación de eventos ---
    const initializeApp = async () => {
        const challengesCollection = db.collection('challenges');
        try {
            const snapshot = await challengesCollection.orderBy('createdAt').get();

            if (snapshot.empty) {
                console.log("Colección de retos vacía. Populando desde la lista local...");
                const initialChallenges = [
                    { text_es: "Hazte un selfie con 5 personas que no conozcas.", text_en: "Take a selfie with 5 people you don’t know." },
                    { text_es: "Consigue que alguien te enseñe su mejor paso de baile.", text_en: "Get someone to show you their best dance move." },
                    { text_es: "Habla con alguien durante 2 minutos con acento exagerado.", text_en: "Talk to someone for 2 minutes using an exaggerated accent." },
                    { text_es: "Pide a un desconocido que te cuente cómo conoció a los novios.", text_en: "Ask a stranger to tell you how they met the couple." },
                    { text_es: "Haz una pose dramática de telenovela en una foto.", text_en: "Do a dramatic soap-opera pose in a photo." },
                    { text_es: "Imita el baile de los novios (aunque todavía no haya pasado).", text_en: "Imitate the couple’s first dance (even if it hasn’t happened yet)." },
                    { text_es: "Haz reír a alguien contando un chiste malísimo.", text_en: "Make someone laugh by telling a terrible joke." },
                    { text_es: "Consigue que 3 personas levanten sus copas contigo.", text_en: "Get 3 people to raise their glasses with you." },
                    { text_es: "Saluda a alguien como si fuera una celebridad famosa.", text_en: "Greet someone as if they were a famous celebrity." },
                    { text_es: "Canta una frase de una canción romántica a alguien.", text_en: "Sing a line from a romantic song to someone." },
                    { text_es: "Baila 30 segundos con alguien que tenga más de 60 años.", text_en: "Dance for 30 seconds with someone over 60." },
                    { text_es: "Forma un mini grupo de baile con 4 personas.", text_en: "Form a mini dance group with 4 people." },
                    { text_es: "Haz el baile más ridículo posible durante 10 segundos.", text_en: "Do the silliest dance you can for 10 seconds." },
                    { text_es: "Baila una canción sin mover los pies.", text_en: "Dance to a song without moving your feet." },
                    { text_es: "Enseña a alguien un paso inventado por ti.", text_en: "Teach someone a dance move you invented." },
                    { text_es: "Haz una foto con alguien que lleve algo azul.", text_en: "Take a photo with someone wearing something blue." },
                    { text_es: "Haz una foto con los novios (si se dejan 😄).", text_en: "Take a photo with the couple (if they let you 😄)." },
                    { text_es: "Haz una foto saltando con un grupo.", text_en: "Take a jumping group photo." },
                    { text_es: "Haz una foto con alguien del lado contrario de la familia.", text_en: "Take a photo with someone from the other side of the family." },
                    { text_es: "Recrea una escena romántica de película.", text_en: "Recreate a romantic movie scene." },
                    { text_es: "Brinda con alguien que hayas conocido hoy.", text_en: "Make a toast with someone you met today." },
                    { text_es: "Pregunta a alguien su mejor consejo para los novios.", text_en: "Ask someone for their best advice for the couple." },
                    { text_es: "Encuentra a alguien que haya viajado más lejos para la boda.", text_en: "Find someone who traveled the farthest for the wedding." },
                    { text_es: "Consigue que alguien te cuente una anécdota de los novios.", text_en: "Get someone to tell you a story about the couple." },
                    { text_es: "Convence a alguien para que salga a bailar contigo ahora mismo.", text_en: "Convince someone to come dance with you right now." },
                    { text_es: "Consigue que 5 personas hagan un tren contigo.", text_en: "Get 5 people to form a dance train with you." },
                    { text_es: "Pide a alguien que te enseñe su mejor cara para selfies.", text_en: "Ask someone to show you their best selfie face." },
                    { text_es: "Haz una foto fingiendo llorar de emoción.", text_en: "Take a photo pretending to cry with emotion." },
                    { text_es: "Encuentra a alguien con los mismos zapatos que tú.", text_en: "Find someone wearing the same shoes as you." },
                    { text_es: "Organiza un aplauso colectivo inesperado.", text_en: "Start a spontaneous group applause." }
                ];

                const batch = db.batch();
                initialChallenges.forEach((challenge, index) => {
                    const docRef = challengesCollection.doc();
                    batch.set(docRef, { ...challenge, createdAt: firebase.firestore.Timestamp.fromMillis(Date.now() + index) });
                });
                await batch.commit();
                return initializeApp(); // Re-ejecutar para cargar los retos recién creados
            } else {
                challenges = snapshot.docs.map(doc => `${doc.data().text_es}\n${doc.data().text_en}`);
                console.log(`${challenges.length} retos cargados desde Firestore.`);
            }
        } catch (error) {
            console.error("Error al cargar los retos:", error);
        }
        // Una vez cargados los retos, asignamos el evento al formulario
        memoryForm.addEventListener('submit', handleFormSubmit);
    };

    initializeApp();
});