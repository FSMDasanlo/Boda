document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const storage = firebase.storage();
    const gallery = document.getElementById('gallery');
    const searchInput = document.getElementById('search-input');
    const downloadBtn = document.getElementById('download-btn');
    const totalCounter = document.getElementById('total-counter');
    const paginationContainer = document.getElementById('pagination');

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

    // Función para filtrar y pintar la galería
    const renderGallery = () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        // Filtramos los recuerdos que coincidan con el nombre
        const filteredMemories = allMemories.filter(item => 
            item.data.guestName.toLowerCase().includes(searchTerm)
        );

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
                imagesHtml = `<div class="memory-images">
                    ${data.imageUrls.map(url => `<img src="${url}" crossorigin="anonymous" onclick="window.open(this.src, '_blank')" alt="Foto recuerdo">`).join('')}
                </div>`;
            }

            card.innerHTML = `
                <div class="memory-header">
                    <h3>${escapeHtml(data.guestName)}</h3>
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
    db.collection('memories').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
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