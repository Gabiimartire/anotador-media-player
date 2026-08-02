// app.js

// --- 1. LÓGICA DEL REPRODUCTOR DE YOUTUBE ---
let player

function onYouTubeIframeAPIReady() {
    player = new YT.Player('reproductor', {
        height: '100%',
        width: '100%',
        videoId: 'jfKfPfyJRdk', 
        playerVars: {
            'autoplay': 1,      
            'controls': 0,     
            'disablekb': 1,     
            'fs': 0,            
            'mute': 1,         
            'origin': 'https://www.youtube.com',
            'cc_load_policy': 0,  // Fuerza a apagar los subtítulos
            'iv_load_policy': 3   // Oculta las tarjetas interactivas
        },
        events: {
            'onStateChange': function(event) {
                // Si está reproduciendo (1), matamos los subtítulos a la fuerza
                if (event.data === 1 && typeof player.unloadModule === 'function') {
                    player.unloadModule('captions')
                    player.unloadModule('cc')
                }
                // Si el video terminó (0), pasamos al siguiente automáticamente
                if (event.data === 0) { 
                    player.nextVideo() 
                }
            }
        }
    })
}

// Nueva función inteligente que detecta si es un video suelto o una Playlist
function extraerVideoId(input) {
    if (!input) return null
    let resultado = { videoId: null, listId: null }

    // Buscamos si el enlace tiene una lista (ej: list=PLx0sYb...)
    let matchList = input.match(/[?&]list=([^#\&\?]+)/)
    if (matchList) resultado.listId = matchList[1]

    // Buscamos el ID normal del video
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
        resultado.videoId = input.trim()
    } else {
        let matchVideo = input.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
        if (matchVideo) resultado.videoId = matchVideo[1]
    }

    return (resultado.videoId || resultado.listId) ? resultado : null
}


// --- 2. LÓGICA DEL ANOTADOR Y VARIABLES ---
let ptsNosotros = 0
let ptsEllos = 0
let equipoSeleccionado = 'nosotros' 
let estadoApp = 'jugando' 

const divNosotros = document.getElementById('equipo-nosotros')
const divEllos = document.getElementById('equipo-ellos')
const textNosotros = document.getElementById('puntos-nosotros')
const textEllos = document.getElementById('puntos-ellos')

const modalVideo = document.getElementById('modal-video')
const modalReinicio = document.getElementById('modal-reinicio')
const inputVideo = document.getElementById('input-video')
const textoGanador = document.getElementById('texto-ganador')

function estadoEquipo(puntos) {
    let puntaje = parseInt(puntos.innerText) 
    if(puntaje >= 15){
        puntos.style.color = 'green'
    }else{
        puntos.style.color = 'red'
    }
}

function actualizarUI() {
    textNosotros.innerText = ptsNosotros
    textEllos.innerText = ptsEllos
    
    estadoEquipo(textNosotros)
    estadoEquipo(textEllos)

    if (equipoSeleccionado === 'nosotros') {
        divNosotros.classList.add('activo')
        divEllos.classList.remove('activo')
    } else {
        divEllos.classList.add('activo')
        divNosotros.classList.remove('activo')
    }
}

function verificarGanador() {
    if (ptsNosotros === 30 || ptsEllos === 30) {
        let ganador = ptsNosotros === 30 ? "Nosotros" : "Ellos"
        estadoApp = 'modal-reinicio'
        textoGanador.innerText = `¡Terminó el partido! Ganó el equipo "${ganador}"`
        modalReinicio.classList.remove('oculto')
    }
}


// --- 3. ESCUCHA DEL CONTROL REMOTO ---
document.addEventListener('keydown', function(event) {
    
    // --- VENTANA DE REINICIO ---
    if (estadoApp === 'modal-reinicio') {
        if (event.keyCode === 13) { // OK
            ptsNosotros = 0
            ptsEllos = 0
            actualizarUI()
            modalReinicio.classList.add('oculto')
            estadoApp = 'jugando'
        } else if (event.keyCode === 461 || event.keyCode === 27) { // Atrás o ESC
            modalReinicio.classList.add('oculto')
            estadoApp = 'jugando'
        }
        return 
    }

    // --- VENTANA DE CAMBIAR VIDEO ---
    if (estadoApp === 'modal-video') {
        if (event.keyCode === 13) { // OK
            let extraido = extraerVideoId(inputVideo.value)
            
            if (extraido && player) {
                // Si encontramos una Lista, cargamos la Playlist entera (¡Esto arregla el Next!)
                if (extraido.listId && typeof player.loadPlaylist === 'function') {
                    player.loadPlaylist({
                        list: extraido.listId,
                        listType: 'playlist',
                        index: 0
                    })
                } 
                // Si no hay lista, cargamos el video individual
                else if (extraido.videoId && typeof player.loadVideoById === 'function') {
                    player.loadVideoById(extraido.videoId)
                }
            }
            
            modalVideo.classList.add('oculto')
            estadoApp = 'jugando'
            inputVideo.blur() 
        } else if (event.keyCode === 461 || event.keyCode === 27) { // Atrás o ESC
            modalVideo.classList.add('oculto')
            estadoApp = 'jugando'
            inputVideo.blur()
        }
        return 
    }

    // --- CONTROLES NORMALES (JUGANDO) ---
    switch(event.keyCode) {
        case 37: // Izquierda
            equipoSeleccionado = 'nosotros'
            actualizarUI()
            break
            
        case 39: // Derecha
            equipoSeleccionado = 'ellos'
            actualizarUI()
            break
            
        case 38: // Arriba
            if (equipoSeleccionado === 'nosotros' && ptsNosotros < 30) ptsNosotros++
            if (equipoSeleccionado === 'ellos' && ptsEllos < 30) ptsEllos++
            actualizarUI()
            verificarGanador()
            break
            
        case 40: // Abajo
            if (equipoSeleccionado === 'nosotros' && ptsNosotros > 0) ptsNosotros--
            if (equipoSeleccionado === 'ellos' && ptsEllos > 0) ptsEllos--
            actualizarUI()
            break
            
        case 13: // Botón OK / Enter (Pausar/Play)
            if (player && typeof player.getPlayerState === 'function') {
                if (player.isMuted()) {
                    player.unMute()
                    player.setVolume(100)
                }
                if (player.getPlayerState() === 1) { 
                    player.pauseVideo() 
                } else {
                    player.playVideo()  
                }
            }
            break

        case 48:  // Tecla '0'
        case 96:  // Numpad '0'
        case 406: // Botón AZUL LG
            estadoApp = 'modal-video'
            modalVideo.classList.remove('oculto')
            inputVideo.value = '' 
            inputVideo.focus() 
            break

        case 49:  // Tecla '1'
        case 97:  // Numpad '1'
        case 427: // Botón "Channel Up" / "Next" LG
            if (player && typeof player.nextVideo === 'function') {
                player.nextVideo()
            }
            break
    }
})
// Arrancar la interfaz
actualizarUI()