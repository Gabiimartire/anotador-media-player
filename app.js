
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
            'origin': window.location.origin,
            'cc_load_policy': 0,
            'iv_load_policy': 3   
        },
        events: {
            'onStateChange': function(event) {
                if (event.data === 0) { 
                    player.nextVideo(); 
                }
            }
        }})
}
function extraerVideoId(input) {
    if (!input) return null 
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
        return input.trim() 
    }
    let coincidencia = input.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/) 
    return coincidencia ? coincidencia[1] : null 
}
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
        let ganador = ptsNosotros === 30 ? "Nosotros" : "Ellos";
        estadoApp = 'modal-reinicio';
        textoGanador.innerText = `¡Terminó el partido! Ganó el equipo "${ganador}"`;
        modalReinicio.classList.remove('oculto');
    }
}
function estadoEquipo(puntos){
    let puntaje = parseInt(puntos.innerText);
    if(puntos.innerText >= 15){
        console.log('verde')
        colorNosotros = 'green'
        puntos.style.color = colorNosotros 
    }else{
        console.log('rojo')
        colorNosotros = 'red'
        puntos.style.color = colorNosotros 
    }
}
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
            let nuevoId = extraerVideoId(inputVideo.value);
            if (nuevoId && player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(nuevoId);
            }
            modalVideo.classList.add('oculto');
            estadoApp = 'jugando';
            inputVideo.blur(); 
        } else if (event.keyCode === 461 || event.keyCode === 27) { 
            modalVideo.classList.add('oculto'); 
            estadoApp = 'jugando';
            inputVideo.blur();
        }
        return; 
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
        case 406: 
            estadoApp = 'modal-video'
            modalVideo.classList.remove('oculto')
            inputVideo.value = '' 
            inputVideo.focus() 
            break
        case 49: 
        case 427:
            if (player && typeof player.nextVideo === 'function') {
                player.nextVideo()
            }
            break
    }
})

actualizarUI() 