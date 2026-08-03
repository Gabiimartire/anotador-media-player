// app.js

// --- 1. LÓGICA DEL REPRODUCTOR DE YOUTUBE ---
let player

// --- Config de YouTube Data API (para buscar un video relacionado si no hay "siguiente") ---
const YT_API_KEY = 'AIzaSyA-27uzeSv3ZfHLWXxq4Bb0u9FpDhRCKsQ'
let videoActualId = null
let intentosRelacionado = 0

function onYouTubeIframeAPIReady() {
    player = new YT.Player('reproductor', {
        events: {
            'onStateChange': function(event) {
                if (event.data === 1 && typeof player.unloadModule === 'function') {
                    player.unloadModule('captions');
                    player.unloadModule('cc');
                }
                if (event.data === 1) {
                    sincronizarVideoActual()
                    intentosRelacionado = 0
                }
                if (event.data === 0) { 
                    intentarSiguienteOBuscarRelacionado()
                }
            },
            'onError': function(event) {
                console.warn('No se pudo reproducir ese contenido (código ' + event.data + '), buscando otra opción...')
                buscarVideoRelacionado()
            }
        }
    });
}

function sincronizarVideoActual() {
    if (player && typeof player.getVideoUrl === 'function') {
        let url = player.getVideoUrl()
        let match = url && url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
        if (match) videoActualId = match[1]
    }
}

function intentarSiguienteOBuscarRelacionado() {
    if (!player) return
    player.nextVideo()
    // Le damos 1.5 segundos: si no arrancó nada nuevo (no está "playing" ni "buffering"),
    // es porque no había siguiente de verdad — ahí recién buscamos uno relacionado
    setTimeout(function() {
        let estado = player.getPlayerState()
        if (estado !== 1 && estado !== 3) {
            buscarVideoRelacionado()
        }
    }, 1500)
}
async function buscarVideoRelacionado() {
    // Frenamos si esto ya reintentó varias veces seguidas sin éxito (evita gastar toda la cuota de una)
    if (intentosRelacionado >= 3) {
        intentosRelacionado = 0
        reiniciarComoUltimoRecurso()
        return
    }
    intentosRelacionado++

    if (!videoActualId || !YT_API_KEY) { reiniciarComoUltimoRecurso(); return }

    try {
        let resVideo = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoActualId}&key=${YT_API_KEY}`)
        let dataVideo = await resVideo.json()
        let titulo = dataVideo.items && dataVideo.items[0] && dataVideo.items[0].snippet.title
        if (!titulo) { reiniciarComoUltimoRecurso(); return }

        // 1. Buscamos primero una PLAYLIST relacionada (así después hay "siguientes" de verdad)
        let resPlaylist = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&maxResults=5&q=${encodeURIComponent(titulo)}&key=${YT_API_KEY}`)
        let dataPlaylist = await resPlaylist.json()

        if (dataPlaylist.error) {
            console.warn('YouTube API sin cuota por hoy:', dataPlaylist.error.message)
            reiniciarComoUltimoRecurso()
            return
        }

        let playlists = (dataPlaylist.items || []).map(item => item.id.playlistId).filter(Boolean)

        if (playlists.length > 0) {
            let listaElegida = playlists[Math.floor(Math.random() * playlists.length)]
            player.loadPlaylist({ list: listaElegida, listType: 'playlist', index: 0 })
            return
        }

        // 2. Si no encontramos ninguna playlist, buscamos al menos un video suelto
        let resBusqueda = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(titulo)}&key=${YT_API_KEY}`)
        let dataBusqueda = await resBusqueda.json()
        let candidatos = (dataBusqueda.items || [])
            .map(item => item.id.videoId)
            .filter(id => id && id !== videoActualId)

        if (candidatos.length === 0) { reiniciarComoUltimoRecurso(); return }

        let elegido = candidatos[Math.floor(Math.random() * candidatos.length)]
        player.loadVideoById(elegido)
        videoActualId = elegido
    } catch (e) {
        console.error('No se pudo buscar contenido relacionado:', e)
        reiniciarComoUltimoRecurso()
    }
}

function reiniciarComoUltimoRecurso() {
    if (player && videoActualId && typeof player.loadVideoById === 'function') {
        player.loadVideoById(videoActualId)
    }
}

function extraerVideoId(input) {
    if (!input) return null
    let resultado = { videoId: null, listId: null }

    let matchList = input.match(/[?&]list=([^#\&\?]+)/)
    if (matchList) resultado.listId = matchList[1]

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
    
    if (estadoApp === 'modal-reinicio') {
        if (event.keyCode === 13) {
            ptsNosotros = 0
            ptsEllos = 0
            actualizarUI()
            modalReinicio.classList.add('oculto')
            estadoApp = 'jugando'
        } else if (event.keyCode === 461 || event.keyCode === 27) {
            modalReinicio.classList.add('oculto')
            estadoApp = 'jugando'
        }
        return 
    }

    if (estadoApp === 'modal-video') {
        if (event.keyCode === 13) {
            let extraido = extraerVideoId(inputVideo.value)
            
            if (extraido && player) {
                let esListaReal = extraido.listId && !extraido.listId.startsWith('RD')

                if (esListaReal && typeof player.loadPlaylist === 'function') {
                    player.loadPlaylist({
                        list: extraido.listId,
                        listType: 'playlist',
                        index: 0
                    })
                } 
                else if (extraido.videoId && typeof player.loadVideoById === 'function') {
                    player.loadVideoById(extraido.videoId)
                    videoActualId = extraido.videoId
                }
            }
            
            modalVideo.classList.add('oculto')
            estadoApp = 'jugando'
            inputVideo.blur() 
        } else if (event.keyCode === 461 || event.keyCode === 27) {
            modalVideo.classList.add('oculto')
            estadoApp = 'jugando'
            inputVideo.blur()
        }
        return 
    }

    switch(event.keyCode) {
        case 37:
            equipoSeleccionado = 'nosotros'
            actualizarUI()
            break
            
        case 39:
            equipoSeleccionado = 'ellos'
            actualizarUI()
            break
            
        case 38:
            if (equipoSeleccionado === 'nosotros' && ptsNosotros < 30) ptsNosotros++
            if (equipoSeleccionado === 'ellos' && ptsEllos < 30) ptsEllos++
            actualizarUI()
            verificarGanador()
            break
            
        case 40:
            if (equipoSeleccionado === 'nosotros' && ptsNosotros > 0) ptsNosotros--
            if (equipoSeleccionado === 'ellos' && ptsEllos > 0) ptsEllos--
            actualizarUI()
            break
            
        case 13:
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

        case 48:
        case 96:
        case 406:
            estadoApp = 'modal-video'
            modalVideo.classList.remove('oculto')
            inputVideo.value = '' 
            inputVideo.focus() 
            break

        case 49:
        case 97:
        case 427:
            intentarSiguienteOBuscarRelacionado()
            break

        case 50:
        case 98:
        case 428:
            if (player && typeof player.previousVideo === 'function') {
                player.previousVideo()
            }
            break

        case 461:
        case 27:
            if (typeof webOS !== 'undefined' && webOS.platformBack) {
                webOS.platformBack()
            }
            break
    }
})

function guardar() {
    localStorage.setItem('truco', JSON.stringify({ptsNosotros, ptsEllos}))
}
actualizarUI()