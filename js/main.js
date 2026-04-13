document.addEventListener("DOMContentLoaded", () => {
  // Firebase se inicializa automáticamente gracias a /__/firebase/init.js
  // cuando el sitio está desplegado en Firebase Hosting.
  let db, storage;
  if (typeof firebase !== "undefined") {
    db = firebase.firestore(); // Ahora puedes usar firebase directamente
    storage = firebase.storage(); // Y también storage

    // --- Conectar a Emuladores si se está en entorno local ---
    // Esto permite probar en tu PC sin tocar la base de datos real
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.port === "5000"
    ) {
      console.log("Entorno local detectado. Usando emuladores.");
      db.useEmulator("localhost", 8080);
      storage.useEmulator("localhost", 9199);
    }
  } else {
    console.warn(
      "Firebase no está disponible. Funcionalidades de base de datos deshabilitadas.",
    );
  }

  // --- Selectores de elementos ---
  const weddingInfo = document.querySelector(".wedding-info");
  const card = document.querySelector(".card");
  const flipButton = document.querySelector(".memory-button");
  const backButton = document.querySelector(".back-button");

  // Elementos del formulario
  const memoryForm = document.getElementById("memory-form");
  const guestNameInput = document.getElementById("guest-name");
  const messageBox = document.getElementById("message-box");
  const emojiBtn = document.getElementById("emoji-btn");
  const emojiPanel = document.getElementById("emoji-panel");
  const uploadPhotoButton = document.getElementById("upload-photo-button");
  const photoUploadInput = document.getElementById("photo-upload");
  const imagePreview = document.getElementById("image-preview-container");
  const charCounter = document.getElementById("char-counter");
  const confirmationMessage = document.getElementById("confirmation-message");

  let savedRange = null; // Para guardar la posición del cursor en el editor

  if (!card || !flipButton || !backButton || !memoryForm) {
    console.error("Alguno de los elementos principales no se encontró.");
    return;
  }

  // --- Lógica para girar la tarjeta ---
  const flipCard = (event) => {
    event.preventDefault();
    card.classList.toggle("is-flipped");
  };
  flipButton.addEventListener("click", flipCard);
  backButton.addEventListener("click", flipCard);

  // --- Lógica del editor de texto ---
  // Funciones para guardar y restaurar la selección del cursor.
  // Esto es clave para que los emojis se inserten donde está el cursor y no al principio.
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Verificamos si el cursor está dentro del editor antes de guardar la posición
      if (messageBox.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    messageBox.focus(); // Es crucial re-enfocar el editor primero
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    } else {
      // Si no hay posición guardada, posicionamos el cursor al final del contenido
      const range = document.createRange();
      range.selectNodeContents(messageBox);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // --- Lógica del panel de Emojis ---
  const emojis = [
    "❤️",
    "😂",
    "🎉",
    "🥳",
    "🥰",
    "🥂",
    "💃",
    "🕺",
    "✨",
    "👍",
    "🙏",
    "😊",
    "😎",
    "💖",
    "😍",
    "🔥",
    "💍",
    "💒",
    "🎂",
    "🎈",
    "🎁",
    "📷",
    "💌",
    "🌟",
    "💐",
    "🍷",
    "🍰",
    "🎊",
    "🤩",
    "🙌",
  ];

  // Poblar el panel de emojis
  emojis.forEach((emoji) => {
    const span = document.createElement("span");
    span.textContent = emoji;
    span.addEventListener("click", () => {
      insertEmoji(emoji);
    });
    emojiPanel.appendChild(span);
  });

  // Función para insertar el emoji en el contenteditable
  const insertEmoji = (emoji) => {
    restoreSelection(); // Restaura la posición del cursor antes de insertar
    document.execCommand("insertText", false, emoji);
    emojiPanel.classList.remove("show");
    // Guardamos la nueva posición del cursor para la siguiente acción
    saveSelection();
  };

  // Mostrar/ocultar el panel
  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Evita que el click se propague al documento y cierre el panel inmediatamente
    emojiPanel.classList.toggle("show");
  });

  // Ocultar el panel si se hace click fuera
  document.addEventListener("click", (e) => {
    if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) {
      emojiPanel.classList.remove("show");
    }
  });

  // Usamos el evento selectionchange para capturar la posición del cursor de forma constante
  document.addEventListener("selectionchange", saveSelection);

  // --- Lógica del contador de caracteres ---
  const MAX_CHARS = 500;
  charCounter.textContent = `0 / ${MAX_CHARS}`; // Inicializar

  messageBox.addEventListener("input", () => {
    const currentLength = messageBox.innerText.length;

    charCounter.textContent = `${currentLength} / ${MAX_CHARS}`;

    if (currentLength > MAX_CHARS) {
      charCounter.style.color = "#ff4d4d"; // Rojo para indicar que se pasó
    } else {
      charCounter.style.color = "rgba(255, 255, 255, 0.7)";
    }
  });

  // --- Lógica para subir foto ---
  let selectedFiles = [];
  uploadPhotoButton.addEventListener("click", () => {
    photoUploadInput.click(); // Abre el diálogo de archivo
  });

  photoUploadInput.addEventListener("change", async (event) => {
    const newFiles = Array.from(event.target.files);

    if (selectedFiles.length + newFiles.length > 5) {
      alert("Puedes subir un máximo de 5 fotos.");
      photoUploadInput.value = null;
      return;
    }

    // Deshabilitar el botón mientras se procesan los archivos para dar feedback
    uploadPhotoButton.disabled = true;
    uploadPhotoButton.textContent = "⏳";

    for (const originalFile of newFiles) {
      let fileToProcess = originalFile;

      // Comprimir si es una imagen (y no un GIF animado, que perdería la animación)
      if (
        fileToProcess.type.startsWith("image/") &&
        !fileToProcess.type.includes("gif")
      ) {
        const options = {
          maxSizeMB: 0.5, // Comprimir a un máximo de 500KB
          maxWidthOrHeight: 1920, // Redimensionar si es más grande para no exceder HD
          useWebWorker: true,
        };

        try {
          const compressedBlob = await imageCompression(fileToProcess, options);
          // Recreamos el archivo (File) desde el Blob para mantener el nombre original
          fileToProcess = new File([compressedBlob], originalFile.name, {
            type: compressedBlob.type,
            lastModified: Date.now(),
          });
        } catch (error) {
          console.error(
            "Error al comprimir la imagen, se usará el original:",
            error,
          );
          // Si falla la compresión, no hacemos nada y fileToProcess sigue siendo el archivo original
        }
      }

      // Añadimos la foto (comprimida o no) a nuestro array
      selectedFiles.push(fileToProcess);

      // --- Creamos la vista previa de la imagen ---
      const previewWrapper = document.createElement("div");
      previewWrapper.classList.add("image-preview-item");

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.classList.add("remove-image-btn");
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = () => {
        previewWrapper.remove();
        const index = selectedFiles.indexOf(fileToProcess);
        if (index > -1) {
          selectedFiles.splice(index, 1);
        }
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        previewWrapper.style.backgroundImage = `url(${e.target.result})`;
      };
      reader.readAsDataURL(fileToProcess);

      previewWrapper.appendChild(removeBtn);
      imagePreview.appendChild(previewWrapper);
    }
    // Reactivar el botón y limpiar el input para poder seleccionar más archivos
    uploadPhotoButton.disabled = false;
    uploadPhotoButton.textContent = "📷";
    photoUploadInput.value = null;
  });

  // --- Lógica de envío a Firebase (mejorada) ---
  const saveMemory = async (guestName, messageHTML, files) => {
    if (!db || !storage) {
      throw new Error("Firebase no está disponible");
    }
    // 1. Subir imágenes a Firebase Storage si existen
    let imageUrls = [];
    if (files.length > 0) {
      const uploadPromises = files.map((file) => {
        const filePath = `memories/${Date.now()}_${file.name}`;
        const fileRef = storage.ref().child(filePath);
        // Subimos el archivo (especificando el tipo para las reglas) y obtenemos la URL
        return fileRef
          .put(file, { contentType: file.type })
          .then(() => fileRef.getDownloadURL());
      });
      imageUrls = await Promise.all(uploadPromises);
    }

    // 2. Guardar los datos en Firestore
    const memoryData = {
      guestName: guestName,
      messageHTML: messageHTML,
      imageUrls: imageUrls, // Volvemos a usar el campo original de URLs de imágenes
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("memories").add(memoryData);
  };

  // Función para escapar HTML y evitar XSS
  function escapeHtml(text) {
    if (!text) return "";
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Helper para resetear el formulario
  const resetForm = (enableButton = true) => {
    const submitButton = memoryForm.querySelector(".submit-button");
    guestNameInput.value = "";
    messageBox.innerHTML = "";
    imagePreview.innerHTML = "";
    selectedFiles = [];
    charCounter.textContent = `0 / ${MAX_CHARS}`;
    charCounter.style.color = "rgba(255, 255, 255, 0.7)";
    if (enableButton) {
      submitButton.disabled = false;
      submitButton.classList.remove("loading");
      submitButton.textContent = "Enviar / Send";
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    if (!db) {
      alert(
        "La base de datos no está disponible. Por favor, recarga la página o verifica tu conexión.",
      );
      return;
    }

    const guestName = guestNameInput.value;
    const messageHTML = messageBox.innerHTML;
    const filesToUpload = [...selectedFiles]; // Copia para procesar en segundo plano

    const submitButton = memoryForm.querySelector(".submit-button");

    // --- Validaciones ---
    if (messageBox.innerText.length > MAX_CHARS) {
      alert(
        `Tu mensaje es demasiado largo. El límite es de ${MAX_CHARS} caracteres.`,
      );
      messageBox.focus();
      return;
    }
    if (!guestName.trim()) {
      alert("Por favor, no te olvides de poner tu nombre.");
      guestNameInput.focus();
      return;
    }
    if (!messageHTML.trim() && filesToUpload.length === 0) {
      alert("Por favor, escribe un mensaje o sube una foto.");
      messageBox.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add("loading");

    // FEEDBACK INMEDIATO: Mostrar "Procesando" antes de saber si hay reto
    confirmationMessage.innerHTML = `
            <div class="confirmation-icon-loading"></div>
            <h2>Procesando...</h2>
        `;
    confirmationMessage.classList.add("show");

    try {
      // 1. Obtener el número actual de recuerdos para mostrar un mensaje personalizado
      const snapshot = await db.collection("memories").get();
      const count = snapshot.size;
      const newCount = count + 1;

      // 2. Actualizar mensaje de carga: Si hay reto, lo decimos YA.
      const friendlyGuestName = escapeHtml(guestName.trim().split(" ")[0]);

      const savingInfoEs = `Guardando ${filesToUpload.length > 0 ? `tus ${filesToUpload.length} foto(s) y ` : ""}tu mensaje...`;
      const savingInfoEn = `Saving ${filesToUpload.length > 0 ? `your ${filesToUpload.length} photo(s) and ` : ""}your message...`;
      confirmationMessage.innerHTML = `
                  <div class="confirmation-icon-loading"></div>
                  <h2>¡Gracias, ${friendlyGuestName}!</h2>
                  <p>Eres la persona n.º ${newCount} en dejarnos un recuerdo.</p>
                  <p class="sending-info">${savingInfoEs}<br><em style="opacity:0.8; font-size:0.9em;">${savingInfoEn}</em></p>
              `;

      // 3. Iniciar el guardado en segundo plano y un temporizador mínimo de 5 segundos.
      const savePromise = saveMemory(guestName, messageHTML, filesToUpload);
      const timerPromise = new Promise((resolve) => setTimeout(resolve, 5000));

      await Promise.all([savePromise, timerPromise]);

      // 4. Flujo normal: El mensaje se queda hasta que el usuario pulsa el botón
      confirmationMessage.innerHTML = `
                  <div class="confirmation-icon">&#10004;</div>
                  <h2>¡Recuerdo guardado!</h2>
                  <p>Gracias por formar parte de nuestro día.</p>
                  <p style="font-size: 1em; opacity: 0.8; margin-top: 5px;"><em>Memory saved! Thank you for being part of our day.</em></p>
                  <button type="button" id="close-success-btn" class="submit-button" style="margin-top: 20px;">Hecho / Done</button>
              `;
      const icon = confirmationMessage.querySelector(".confirmation-icon");
      if (icon)
        icon.style.animation =
          "pop-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards";

      // 5. Añadimos un listener al nuevo botón para cerrar y resetear
      document
        .getElementById("close-success-btn")
        .addEventListener("click", () => {
          confirmationMessage.classList.remove("show");
          // Pequeño delay para que la transición de opacidad termine antes de girar
          setTimeout(() => {
            resetForm(true);
            card.classList.remove("is-flipped");
          }, 500); // 500ms coincide con la transición de opacidad del CSS
        });

      // Reseteamos el formulario en segundo plano, pero no el botón de envío.
      resetForm(false);
    } catch (error) {
      console.error("Error al guardar el recuerdo: ", error);

      confirmationMessage.innerHTML = `
                <div class="confirmation-icon" style="color: #ff4d4d;">&times;</div>
                <h2>¡Ups! Hubo un error</h2>
                <p>No se pudo guardar tu recuerdo. Por favor, inténtalo de nuevo en un momento.</p>
            `;
      const errorIcon = confirmationMessage.querySelector(".confirmation-icon");
      if (errorIcon)
        errorIcon.style.animation =
          "pop-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards";

      setTimeout(() => {
        confirmationMessage.classList.remove("show");
        submitButton.disabled = false;
        submitButton.classList.remove("loading");
        submitButton.textContent = "Enviar / Send";
      }, 5000);
    }
  };

  // --- Lógica para cambiar el idioma del texto inferior ---
  // Ahora es un ciclo independiente y más lento para que dé tiempo a leer.
  if (weddingInfo) {
    setInterval(() => {
      weddingInfo.classList.toggle("lang-en");
    }, 4000); // Cambia de idioma cada 4 segundos.
  }

  // --- Carga inicial de datos y asignación de eventos ---
  const initializeApp = async () => {
    // Ya no cargamos retos ni populamos colecciones iniciales.
    // Simplemente asignamos el evento al formulario.
    memoryForm.addEventListener("submit", handleFormSubmit);
  };

  initializeApp();
});
