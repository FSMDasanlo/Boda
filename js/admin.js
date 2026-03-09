document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const storage = firebase.storage();
    const gallery = document.getElementById('gallery');
    const searchInput = document.getElementById('search-input');
    const downloadBtn = document.getElementById('download-btn');
    const filterChallengesBtn = document.getElementById('filter-challenges-btn');
    const challengesAdminBtn = document.getElementById('challenges-admin-btn');
    const challengesAdminSection = document.getElementById('challenges-admin-section');
    const closeChallengesAdminBtn = document.getElementById('close-challenges-admin-btn');
    const challengesList = document.getElementById('challenges-list');
    const newChallengeEsInput = document.getElementById('new-challenge-es');
    const newChallengeEnInput = document.getElementById('new-challenge-en');
    const addChallengeBtn = document.getElementById('add-challenge-btn');
    const totalCounter = document.getElementById('total-counter');
    const paginationContainer = document.getElementById('pagination');
    
    // Elementos del Modal
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalCaption = document.getElementById('modal-caption');
    const closeModal = document.querySelector('.close-modal');

    // --- Conectar a Emuladores si se está en entorno local ---
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        console.log("Entorno local detectado. Usando emuladores.");
        db.useEmulator("localhost", 8080);
        storage.useEmulator("localhost", 9199);
    }

    // --- Protección simple (NO SEGURA, solo para ocultar la vista) ---
    const password = prompt("Introduce la contraseña de administrador:");
    // Cambia "boda2026" por la contraseña que quieras
    if (password !== "boda2026") {
        document.body.innerHTML = "<h1 style='text-align:center; margin-top:50px;'>Acceso denegado</h1>";
        return;
    }

    let allMemories = []; // Almacén local de todos los recuerdos
    const ITEMS_PER_PAGE = 9; // Número de tarjetas por página
    let currentPage = 1;
    let showOnlyChallenges = false; // Estado del filtro

    // Función para filtrar y pintar la galería
    const renderGallery = () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        // Filtramos los recuerdos que coincidan con el nombre Y el filtro de retos
        const filteredMemories = allMemories.filter(item => {
            const matchesSearch = item.data.guestName.toLowerCase().includes(searchTerm);
            const matchesFilter = showOnlyChallenges ? item.data.isChallengeProof : true;
            return matchesSearch && matchesFilter;
        });

        // --- Lógica de Paginación ---
        const totalPages = Math.ceil(filteredMemories.length / ITEMS_PER_PAGE);
        
        // Si la página actual es mayor que el total (ej: al filtrar), volver a la 1
        if (currentPage > totalPages) currentPage = 1;

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const memoriesToShow = filteredMemories.slice(startIndex, endIndex);

        gallery.innerHTML = ''; // Limpiar galería antes de pintar

        if (filteredMemories.length === 0) {
            gallery.innerHTML = '<p style="text-align: center; width: 100%;">No se encontraron recuerdos.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        memoriesToShow.forEach(({ id, data }) => {
            const card = document.createElement('div');
            card.className = 'memory-card';

            // Formatear fecha
            let dateStr = 'Fecha desconocida';
            if (data.createdAt) {
                dateStr = new Date(data.createdAt.seconds * 1000).toLocaleString();
            }

            // Generar HTML de imágenes si las hay
            let imagesHtml = '';
            if (data.imageUrls && data.imageUrls.length > 0) {
                const imgClass = data.isChallengeProof ? 'challenge-proof-img' : '';
                // Si es prueba de reto, guardamos el texto del reto en data-challenge y quitamos el onclick inline
                const clickAction = data.isChallengeProof ? '' : `onclick="window.open(this.src, '_blank')"`;
                const dataAttr = data.isChallengeProof ? `data-challenge="${escapeHtml(data.challenge || '')}"` : '';
                imagesHtml = `<div class="memory-images">
                    ${data.imageUrls.map(url => `<img src="${url}" class="${imgClass}" ${dataAttr} crossorigin="anonymous" ${clickAction} alt="Foto recuerdo">`).join('')}
                </div>`;
            }

            // Indicador de reto
            let challengeIndicator = '';
            if (data.challenge) {
                challengeIndicator = `<span class="challenge-indicator" title="Reto: ${escapeHtml(data.challenge)}">🏆</span>`;
            }

            card.innerHTML = `
                <div class="memory-header">
                    <h3>${escapeHtml(data.guestName)} ${challengeIndicator}</h3>
                    <div class="header-actions">
                        <span class="memory-date">${dateStr}</span>
                        <button class="delete-btn">Borrar</button>
                    </div>
                </div>
                <div class="memory-body">
                    <div class="memory-message">${data.messageHTML || ''}</div>
                    ${imagesHtml}
                </div>
            `;

            // Añadir evento al botón de borrar
            card.querySelector('.delete-btn').addEventListener('click', () => deleteMemory(id, data));

            gallery.appendChild(card);
        });

        renderPagination(totalPages);
    };

    // --- Lógica del Modal de Retos ---
    // Event delegation para las imágenes de retos (ya que se crean dinámicamente)
    gallery.addEventListener('click', (e) => {
        if (e.target.classList.contains('challenge-proof-img')) {
            modal.style.display = "block";
            modalImg.src = e.target.src;
            // Usamos dataset para recuperar el texto y textContent para seguridad
            modalCaption.textContent = e.target.dataset.challenge; 
        }
    });

    closeModal.onclick = () => { modal.style.display = "none"; }
    
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    }

    // --- Lógica de Administración de Retos ---

    // Toggle para mostrar/ocultar la sección de retos
    challengesAdminBtn.addEventListener('click', () => {
        const isHidden = challengesAdminSection.style.display === 'none';
        challengesAdminSection.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            loadChallenges();
        }
    });

    // Botón para cerrar la sección de retos
    closeChallengesAdminBtn.addEventListener('click', () => {
        challengesAdminSection.style.display = 'none';
    });

    // Añadir un nuevo reto
    addChallengeBtn.addEventListener('click', async () => {
        const textEs = newChallengeEsInput.value.trim();
        const textEn = newChallengeEnInput.value.trim();
        if (!textEs || !textEn) {
            alert('Ambos campos del reto son obligatorios.');
            return;
        }
        try {
            await db.collection('challenges').add({
                text_es: textEs,
                text_en: textEn,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            newChallengeEsInput.value = '';
            newChallengeEnInput.value = '';
            // El listener onSnapshot se encargará de refrescar la lista
        } catch (error) {
            console.error("Error añadiendo reto:", error);
            alert("Error al añadir el reto.");
        }
    });

    // Cargar y mostrar la lista de retos
    const loadChallenges = () => {
        db.collection('challenges').orderBy('createdAt').onSnapshot(snapshot => {
            if (snapshot.empty) {
                challengesList.innerHTML = '<p>No hay retos definidos. Puedes añadirlos desde el formulario de abajo.</p>';
                return;
            }
            challengesList.innerHTML = '';
            snapshot.forEach(doc => {
                const challenge = doc.data();
                const challengeId = doc.id;
                
                // Buscar quién ha completado este reto
                const combinedText = `${challenge.text_es}\n${challenge.text_en}`;
                const completedBy = allMemories
                    .filter(m => m.data.isChallengeProof && m.data.challenge === combinedText)
                    .map(m => `<b>${escapeHtml(m.data.guestName)}</b>`);
                
                const completedHtml = completedBy.length > 0 
                    ? `<div class="challenge-completed-list">✅ Completado por: ${completedBy.join(', ')}</div>` 
                    : '';

                const item = document.createElement('div');
                item.className = 'challenge-item';
                item.innerHTML = `
                    <div class="challenge-item-text">
                        <p>${escapeHtml(challenge.text_es)}</p>
                        <p><em>${escapeHtml(challenge.text_en)}</em></p>
                        ${completedHtml}
                    </div>
                    <div class="challenge-item-actions">
                        <button class="edit-challenge-btn delete-btn" style="background-color: #3498db;">Editar</button>
                        <button class="delete-challenge-btn delete-btn">Borrar</button>
                    </div>
                `;
                item.querySelector('.delete-challenge-btn').addEventListener('click', () => deleteChallenge(challengeId));
                item.querySelector('.edit-challenge-btn').addEventListener('click', (e) => editChallenge(e.target, challengeId, challenge));
                challengesList.appendChild(item);
            });
        });
    };

    // Borrar un reto
    const deleteChallenge = async (id) => {
        if (!confirm('¿Seguro que quieres borrar este reto?')) return;
        try {
            await db.collection('challenges').doc(id).delete();
        } catch (error) {
            console.error("Error borrando reto:", error);
            alert("Error al borrar el reto.");
        }
    };

    // Habilitar edición inline de un reto
    const editChallenge = (button, id, data) => {
        const item = button.closest('.challenge-item');
        const textContainer = item.querySelector('.challenge-item-text');
        textContainer.innerHTML = `
            <textarea class="edit-es">${data.text_es}</textarea>
            <textarea class="edit-en">${data.text_en}</textarea>
        `;
        button.textContent = 'Guardar';
        button.onclick = () => saveChallenge(id, item);
    };

    // Guardar los cambios de un reto editado
    const saveChallenge = async (id, item) => {
        const newTextEs = item.querySelector('.edit-es').value.trim();
        const newTextEn = item.querySelector('.edit-en').value.trim();
        if (!newTextEs || !newTextEn) {
            alert('Ambos campos son obligatorios.');
            return;
        }
        try {
            await db.collection('challenges').doc(id).update({ text_es: newTextEs, text_en: newTextEn });
            // onSnapshot refrescará la vista, no es necesario hacer nada más.
        } catch (error) {
            console.error("Error guardando reto:", error);
            alert("Error al guardar el reto.");
        }
    };

    // Función para pintar los controles de paginación
    const renderPagination = (totalPages) => {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return; // No mostrar si solo hay una página

        const createBtn = (text, onClick, disabled) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.disabled = disabled;
            btn.addEventListener('click', onClick);
            return btn;
        };

        const prevBtn = createBtn('Anterior', () => {
            currentPage--;
            renderGallery();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, currentPage === 1);

        const nextBtn = createBtn('Siguiente', () => {
            currentPage++;
            renderGallery();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, currentPage === totalPages);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

        paginationContainer.append(prevBtn, pageInfo, nextBtn);
    };

    // Escuchar cambios en el input de búsqueda
    searchInput.addEventListener('input', () => {
        currentPage = 1; // Resetear a la primera página al buscar
        renderGallery();
    });

    // Escuchar cambios en el botón de filtro de retos
    filterChallengesBtn.addEventListener('click', () => {
        showOnlyChallenges = !showOnlyChallenges;
        filterChallengesBtn.classList.toggle('active');
        if (showOnlyChallenges) {
            filterChallengesBtn.textContent = 'Ver todo';
        } else {
            // Usamos innerHTML para poder incluir el emoji
            filterChallengesBtn.innerHTML = 'Ver solo Pruebas 🏆';
        }
        currentPage = 1; // Resetear a la primera página
        renderGallery();
    });

    // --- Exportar a PDF ---
    downloadBtn.addEventListener('click', () => {
        const element = document.getElementById('gallery');
        
        // Opciones de configuración del PDF
        const opt = {
            margin:       10, // Margen en mm
            filename:     'recuerdos_boda.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true }, // useCORS es vital para cargar fotos de Firebase
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Añadimos una clase para ocultar botones de borrar durante la foto
        document.body.classList.add('generating-pdf');

        // Generar PDF y luego quitar la clase
        html2pdf().set(opt).from(element).save().then(() => document.body.classList.remove('generating-pdf'));
    });

    // --- Cargar recuerdos en tiempo real ---
    db.collection('memories').orderBy('guestName', 'asc').onSnapshot((snapshot) => {
        // Guardamos los datos en nuestra variable local
        allMemories = snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }));

        // Actualizar contador total
        totalCounter.textContent = `Total mensajes: ${allMemories.length}`;
        
        // Pintamos la galería (aplicando el filtro si ya hay algo escrito)
        renderGallery();
    });

    // Función para borrar un recuerdo y sus fotos
    const deleteMemory = async (docId, data) => {
        if (!confirm('¿Estás seguro de que quieres borrar este recuerdo permanentemente?')) return;

        try {
            // 1. Borrar imágenes de Storage (si tiene)
            if (data.imageUrls && data.imageUrls.length > 0) {
                const deletePromises = data.imageUrls.map(url => 
                    storage.refFromURL(url).delete().catch(e => console.warn("Imagen ya borrada o inaccesible", e))
                );
                await Promise.all(deletePromises);
            }

            // 2. Borrar documento de Firestore
            await db.collection('memories').doc(docId).delete();
            // No hace falta refrescar, onSnapshot lo hará automáticamente
        } catch (error) {
            console.error("Error al borrar:", error);
            alert("Hubo un error al borrar: " + error.message);
        }
    };

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});