/* iCallFake - Motor de Inteligência iOS 17 */

// ================= ESTADO GLOBAL DO APP =================
const state = {
    currentScreen: 'screen-contacts', // Começa na lista de contatos para melhor UX
    previousScreen: 'screen-contacts',
    contacts: [
        { id: 1, firstName: 'Mãe', lastName: '', phone: '(11) 98765-4321', color: '#ff453a', audioType: 'mom' },
        { id: 2, firstName: 'Amor', lastName: '❤️', phone: '(11) 99999-8888', color: '#ff2d55', audioType: 'friend' },
        { id: 3, firstName: 'Chefe', lastName: '💼', phone: '(11) 91234-5678', color: '#8e8e93', audioType: 'boss' },
        { id: 4, firstName: 'Entrega', lastName: 'Sedex', phone: '0800 300 300', color: '#ff9500', audioType: 'delivery' },
        { id: 5, firstName: 'Número', lastName: 'Desconhecido', phone: 'Privado', color: '#5856d6', audioType: 'none' }
    ],
    selectedContact: null,
    isCalling: false,
    isActiveCall: false,
    callDuration: 0,
    timerInterval: null,
    scheduledCallTimeout: null,
    isSpeakerActive: false,
    isMuted: false,
    // Sensores & Ajustes
    settings: {
        gyro: true,
        touch: true,
        hover: true,
        ringtone: true,
        dtmf: true
    },
    audioCtx: null,
    ringtoneInterval: null,
    speechUtterance: null
};

// Mapas de Textos de Voz Falsa (Text to Speech)
const VOICE_PRESETS = {
    none: "...",
    boss: "Oi! Onde você está? Preciso de você na minha sala agora mesmo. O diretor acabou de chegar e precisamos resolver aquele relatório com urgência. Consegue subir agora?",
    mom: "Oi meu filho, tudo bem? Você já comeu? Estou te ligando para saber se você vem jantar hoje. Fiz aquela comida que você gosta. Não se atrase e me avisa quando estiver saindo, tá bom?",
    friend: "Fala bicho, beleza? Cara, o pessoal já tá todo reunido aqui no churrasco, só falta você trazer os refrigerantes e a carne. Onde você tá metido? Corre pra cá!",
    delivery: "Olá, boa tarde. Sou o entregador e estou aqui em frente ao seu portão com uma encomenda que precisa de assinatura. Teria como você descer rapidinho para receber, por favor?"
};

// ================= INICIALIZAÇÃO DO APP =================
document.addEventListener('DOMContentLoaded', () => {
    loadContactsFromStorage();
    renderContactsList();
    initClock();
    registerEventListeners();
    initProximityEvents();
    checkProximityAPISupport();
    
    // Solicitar permissão de giroscópio no primeiro toque (requisito de segurança do iOS)
    document.addEventListener('click', requestiOSPermission, { once: true });
    document.addEventListener('touchstart', requestiOSPermission, { once: true });
});

function requestiOSPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    console.log('Permissão de orientação concedida.');
                    initProximityEvents();
                }
            })
            .catch(err => {
                console.warn('Erro na permissão de sensores iOS:', err);
            });
    }
}

// Relógio da barra de status (iOS)
function initClock() {
    const updateTime = () => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('status-time').innerText = `${hrs}:${mins}`;
    };
    updateTime();
    setInterval(updateTime, 1000 * 30); // atualiza a cada 30 segundos
}

// ================= CONTROLE DE PERSISTÊNCIA =================
function loadContactsFromStorage() {
    const saved = localStorage.getItem('icallfake_contacts');
    if (saved) {
        state.contacts = JSON.parse(saved);
    } else {
        localStorage.setItem('icallfake_contacts', JSON.stringify(state.contacts));
    }
}

function saveContactsToStorage() {
    localStorage.setItem('icallfake_contacts', JSON.stringify(state.contacts));
}

// ================= NAVEGAÇÃO DE TELAS =================
function navigateTo(screenId) {
    const current = document.querySelector('.app-screen.active');
    if (current) {
        current.classList.remove('active');
        current.classList.add('hidden');
    }

    const next = document.getElementById(screenId);
    if (next) {
        next.classList.remove('hidden');
        next.classList.add('active');
        state.previousScreen = state.currentScreen;
        state.currentScreen = screenId;
    }

    // Gerenciar visibilidade da barra de navegação inferior
    const navBar = document.getElementById('app-nav-bar');
    const floatingBtn = document.getElementById('floating-sensor-btn');
    
    if (screenId === 'screen-incoming' || screenId === 'screen-active') {
        navBar.style.display = 'none';
        floatingBtn.style.display = 'flex'; // Exibe o atalho de proximidade nas chamadas
    } else {
        navBar.style.display = 'flex';
        floatingBtn.style.display = 'none';
    }

    // Reset de animação da Dynamic Island dependendo da tela
    const island = document.getElementById('dynamic-island');
    if (screenId === 'screen-active') {
        island.classList.add('expanded');
        document.getElementById('island-status').innerText = 'Chamada ativa • ' + getFormattedDuration();
    } else if (screenId === 'screen-incoming') {
        island.classList.add('expanded');
        document.getElementById('island-status').innerText = 'Recebendo chamada...';
    } else {
        island.classList.remove('expanded');
    }
}

// ================= RENDERIZAR CONTATOS =================
function renderContactsList(filter = '') {
    const container = document.getElementById('contacts-list-container');
    container.innerHTML = '';

    // Filtrar contatos
    const filtered = state.contacts.filter(c => {
        const full = `${c.firstName} ${c.lastName}`.toLowerCase();
        return full.includes(filter.toLowerCase()) || c.phone.includes(filter);
    });

    // Ordenar por primeiro nome
    filtered.sort((a, b) => a.firstName.localeCompare(b.firstName));

    // Agrupar por letra inicial
    let currentLetter = '';

    filtered.forEach(contact => {
        const initial = contact.firstName.charAt(0).toUpperCase();
        
        if (initial !== currentLetter) {
            currentLetter = initial;
            const letterHeader = document.createElement('div');
            letterHeader.className = 'contact-group-letter';
            letterHeader.innerText = currentLetter;
            container.appendChild(letterHeader);
        }

        const item = document.createElement('div');
        item.className = 'contact-item';
        item.innerHTML = `
            <span class="contact-item-name">${contact.firstName} ${contact.lastName}</span>
            <span class="contact-item-arrow">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </span>
        `;
        
        item.addEventListener('click', () => {
            showContactDetails(contact);
        });

        container.appendChild(item);
    });
}

// ================= DETALHES DO CONTATO =================
function showContactDetails(contact) {
    state.selectedContact = contact;
    
    const avatar = document.getElementById('detail-avatar');
    avatar.innerText = contact.firstName.charAt(0) + (contact.lastName ? contact.lastName.charAt(0) : '');
    avatar.style.backgroundColor = contact.color || '#5856d6';
    
    document.getElementById('detail-name').innerText = `${contact.firstName} ${contact.lastName}`;
    document.getElementById('detail-phone').innerText = contact.phone || 'celular';
    
    // Setar seletor de voz de acordo com o contato
    const voiceSelect = document.getElementById('fake-voice-select');
    voiceSelect.value = contact.audioType || 'none';
    toggleTTSInput(contact.audioType === 'tts');

    navigateTo('screen-contact-details');
}

function toggleTTSInput(show) {
    const ttsContainer = document.getElementById('tts-input-container');
    if (show) {
        ttsContainer.classList.remove('hidden');
    } else {
        ttsContainer.classList.add('hidden');
    }
}

// ================= REGISTRO DE EVENTOS DA INTERFACE =================
function registerEventListeners() {
    // Abas de navegação inferior
    document.getElementById('tab-dialer').addEventListener('click', (e) => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-dialer').classList.add('active');
        navigateTo('screen-dialer');
    });

    document.getElementById('tab-contacts').addEventListener('click', (e) => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-contacts').classList.add('active');
        navigateTo('screen-contacts');
    });

    // Detalhes do contato voltar
    document.getElementById('contact-details-back-btn').addEventListener('click', () => {
        navigateTo('screen-contacts');
    });

    // Filtro de Busca de Contatos
    document.getElementById('contacts-search').addEventListener('input', (e) => {
        renderContactsList(e.target.value);
    });

    // Abrir Modal de Novo Contato
    document.getElementById('open-add-contact-modal').addEventListener('click', () => {
        document.getElementById('modal-add-contact').classList.remove('hidden');
    });

    document.getElementById('btn-cancel-modal').addEventListener('click', () => {
        document.getElementById('modal-add-contact').classList.add('hidden');
    });

    // Salvar Novo Contato
    document.getElementById('btn-save-modal').addEventListener('click', () => {
        const firstName = document.getElementById('contact-first-name').value.trim();
        const lastName = document.getElementById('contact-last-name').value.trim();
        const phone = document.getElementById('contact-phone').value.trim() || 'celular';
        const color = document.getElementById('avatar-color-picker').value;

        if (!firstName) {
            alert('Por favor, informe ao menos o Nome.');
            return;
        }

        const newContact = {
            id: Date.now(),
            firstName,
            lastName,
            phone,
            color,
            audioType: 'none'
        };

        state.contacts.push(newContact);
        saveContactsToStorage();
        renderContactsList();
        
        // Reset campos
        document.getElementById('contact-first-name').value = '';
        document.getElementById('contact-last-name').value = '';
        document.getElementById('contact-phone').value = '';
        
        document.getElementById('modal-add-contact').classList.add('hidden');
    });

    // Teclado de discagem - Digitar números
    document.querySelectorAll('.dialer-keypad .keypad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-value');
            const display = document.getElementById('dialed-number-text');
            display.innerText += val;
            
            // Tocar som DTMF
            playDTMFTone(val);

            document.getElementById('backspace-btn').classList.remove('hidden');
            document.getElementById('add-to-contacts-btn').classList.remove('hidden');
        });
    });

    // Teclado de discagem - Apagar (Backspace)
    document.getElementById('backspace-btn').addEventListener('click', () => {
        const display = document.getElementById('dialed-number-text');
        display.innerText = display.innerText.slice(0, -1);
        if (display.innerText === '') {
            document.getElementById('backspace-btn').classList.add('hidden');
            document.getElementById('add-to-contacts-btn').classList.add('hidden');
        }
    });

    // Adicionar número digitado nos contatos
    document.getElementById('add-to-contacts-btn').addEventListener('click', () => {
        const display = document.getElementById('dialed-number-text');
        document.getElementById('contact-phone').value = display.innerText;
        document.getElementById('modal-add-contact').classList.remove('hidden');
    });

    // Ligar pelo teclado (Número discado)
    document.getElementById('dialer-call-btn').addEventListener('click', () => {
        const display = document.getElementById('dialed-number-text');
        const num = display.innerText || 'Desconhecido';
        
        const contact = {
            firstName: num,
            lastName: '',
            phone: 'Discado',
            color: '#30d158',
            audioType: 'none'
        };
        triggerCallNow(contact);
    });

    // Agendamentos de Chamada Falsa
    document.getElementById('trigger-call-now-btn').addEventListener('click', () => {
        triggerCallNow(state.selectedContact);
    });

    document.querySelectorAll('.delay-buttons-grid .delay-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const delay = parseInt(btn.getAttribute('data-delay'));
            scheduleFakeCall(state.selectedContact, delay);
        });
    });

    document.getElementById('fake-voice-select').addEventListener('change', (e) => {
        toggleTTSInput(e.target.value === 'tts');
        if (state.selectedContact) {
            state.selectedContact.audioType = e.target.value;
            saveContactsToStorage();
        }
    });

    // Botões do Recebimento de Chamada
    document.getElementById('incoming-decline-btn').addEventListener('click', declineIncomingCall);
    document.getElementById('incoming-accept-btn').addEventListener('click', acceptIncomingCall);

    // Botões de chamada ativa
    document.getElementById('active-hangup-btn').addEventListener('click', hangupCall);
    
    // Mudo e Alto-falante
    document.getElementById('active-btn-speaker').addEventListener('click', () => {
        state.isSpeakerActive = !state.isSpeakerActive;
        const btn = document.getElementById('active-btn-speaker');
        const tag = document.getElementById('speaker-tag');
        
        if (state.isSpeakerActive) {
            btn.classList.add('active');
            tag.classList.add('visible');
            adjustFakeVoiceVolume(1.0);
        } else {
            btn.classList.remove('active');
            tag.classList.remove('visible');
            adjustFakeVoiceVolume(0.15); // earpiece simulation (mais baixo)
        }
    });

    document.getElementById('active-btn-mute').addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        const btn = document.getElementById('active-btn-mute');
        if (state.isMuted) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('active-btn-keypad').addEventListener('click', () => {
        alert('Mantenha o celular na orelha. Teclado em chamada não disponível nesta versão.');
    });

    document.getElementById('active-btn-contacts').addEventListener('click', () => {
        alert('Contatos estão congelados durante a chamada de simulação.');
    });

    // Abrir Ajustes (Modal)
    document.getElementById('open-settings-btn').addEventListener('click', () => {
        document.getElementById('modal-settings').classList.remove('hidden');
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
        document.getElementById('modal-settings').classList.add('hidden');
    });

    // Sincronizar Switches de Ajustes
    document.getElementById('setting-gyro').addEventListener('change', (e) => { state.settings.gyro = e.target.checked; });
    document.getElementById('setting-touch').addEventListener('change', (e) => { state.settings.touch = e.target.checked; });
    document.getElementById('setting-hover').addEventListener('change', (e) => { state.settings.hover = e.target.checked; });
    document.getElementById('setting-ringtone').addEventListener('change', (e) => { state.settings.ringtone = e.target.checked; });
    document.getElementById('setting-dtmf').addEventListener('change', (e) => { state.settings.dtmf = e.target.checked; });

    // Botão flutuante (Forçar Proximidade)
    const floatBtn = document.getElementById('floating-sensor-btn');
    floatBtn.addEventListener('mousedown', turnScreenOff);
    floatBtn.addEventListener('mouseup', turnScreenOn);
    floatBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        turnScreenOff();
    });
    floatBtn.addEventListener('touchend', turnScreenOn);

    // Ajuste de Toque Corporal para apagar a tela na chamada ativa
    document.getElementById('screen-active').addEventListener('click', (e) => {
        // Se clicar em um botão da grade ou desligar, não apaga
        if (e.target.closest('.call-grid-btn') || e.target.closest('.hangup-btn-red') || e.target.closest('#floating-sensor-btn')) {
            return;
        }
        if (state.settings.touch && state.isActiveCall) {
            turnScreenOff();
        }
    });

    // Acender a tela ao tocar no blackout
    document.getElementById('blackout-screen').addEventListener('click', turnScreenOn);

    // Inicialização do Slider para Atender (Estilo iOS Real)
    initSlideToAnswer();
}

// ================= SLIDER TO ANSWER (TOQUE) =================
function initSlideToAnswer() {
    const handle = document.getElementById('slide-handle');
    const container = document.getElementById('slide-container');
    let isDragging = false;
    let startX = 0;
    const maxSlide = 190; // Distância do deslize

    // Mostrar ou ocultar o Slider dependendo do dispositivo (no Desktop mostramos os botões padrão, no Mobile o slide)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.querySelector('.action-accept-box').style.display = 'none';
        container.style.display = 'block';
    } else {
        document.querySelector('.action-accept-box').style.display = 'flex';
        container.style.display = 'none';
    }

    const onStart = (clientX) => {
        isDragging = true;
        startX = clientX;
        handle.style.transition = 'none';
    };

    const onMove = (clientX) => {
        if (!isDragging) return;
        let deltaX = clientX - startX;
        if (deltaX < 0) deltaX = 0;
        if (deltaX > maxSlide) deltaX = maxSlide;

        handle.style.transform = `translateX(${deltaX}px)`;
        
        // Efeito de opacidade do texto enquanto desliza
        const opacity = 1 - (deltaX / maxSlide);
        document.querySelector('.slide-text').style.opacity = opacity;

        // Se chegou ao fim do slide, atende automaticamente
        if (deltaX >= maxSlide - 5) {
            isDragging = false;
            handle.style.transform = `translateX(${maxSlide}px)`;
            acceptIncomingCall();
        }
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        handle.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        handle.style.transform = 'translateX(0px)';
        
        const text = document.querySelector('.slide-text');
        text.style.opacity = 1;
    };

    // Eventos Mouse
    handle.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    // Eventos Touch
    handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX));
    window.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX));
    window.addEventListener('touchend', onEnd);
}

// ================= GERAÇÃO DE AUDIO (SINTETIZADO COM WEB AUDIO API) =================
function getAudioContext() {
    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return state.audioCtx;
}

// Tons DTMF do Teclado Numérico
function playDTMFTone(key) {
    if (!state.settings.dtmf) return;
    
    try {
        const ctx = getAudioContext();
        const frequencies = {
            '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
            '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
            '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
            '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
        };

        if (!frequencies[key]) return;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.frequency.value = frequencies[key][0];
        osc2.frequency.value = frequencies[key][1];

        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();

        osc1.stop(ctx.currentTime + 0.2);
        osc2.stop(ctx.currentTime + 0.2);
    } catch (e) {
        console.warn("Erro ao sintetizar áudio DTMF: ", e);
    }
}

// Sintetizador do Toque de Chamada (Ringtone clássico de Chime/Marimba)
function startRingtone() {
    if (!state.settings.ringtone) return;
    
    try {
        const ctx = getAudioContext();
        let beat = 0;
        
        const playTone = (freq, duration, delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
            
            gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + duration);
        };

        const playRingtoneMelody = () => {
            // Notas da melodia premium sintetizada
            const melody = [
                { f: 659.25, d: 0.15, t: 0 },    // E5
                { f: 783.99, d: 0.15, t: 0.18 }, // G5
                { f: 987.77, d: 0.3, t: 0.36 },  // B5
                { f: 880.00, d: 0.15, t: 0.72 }, // A5
                { f: 987.77, d: 0.4, t: 0.9 }    // B5
            ];
            
            melody.forEach(note => {
                playTone(note.f, note.d, note.t);
            });
        };

        // Tocar a cada 2.5 segundos de forma cíclica
        playRingtoneMelody();
        state.ringtoneInterval = setInterval(playRingtoneMelody, 2500);

    } catch (e) {
        console.warn("Falha ao tocar toque do iPhone: ", e);
    }
}

function stopRingtone() {
    if (state.ringtoneInterval) {
        clearInterval(state.ringtoneInterval);
        state.ringtoneInterval = null;
    }
}

// ================= AGENDAMENTOS E DISPARADORES DA CHAMADA =================
function triggerCallNow(contact) {
    state.selectedContact = contact;
    
    // Configurar layout com os dados do contato
    document.getElementById('incoming-caller-name').innerText = `${contact.firstName} ${contact.lastName}`;
    
    // Desfocar background
    const bg = document.getElementById('incoming-blur-bg');
    bg.style.backgroundImage = 'none';
    bg.style.backgroundColor = contact.color || '#1f1f24';

    // Reset de estado
    state.isCalling = true;
    state.isActiveCall = false;

    navigateTo('screen-incoming');
    startRingtone();

    // Feedback de vibração
    if ('vibrate' in navigator) {
        navigator.vibrate([600, 600, 600, 600, 600]);
    }
}

function scheduleFakeCall(contact, seconds) {
    if (state.scheduledCallTimeout) {
        clearTimeout(state.scheduledCallTimeout);
    }

    state.selectedContact = contact;

    // Mostrar agendamento na Dynamic Island de forma linda
    const island = document.getElementById('dynamic-island');
    island.classList.add('expanded');
    
    let countdown = seconds;
    const updateCountdown = () => {
        if (countdown > 0) {
            document.getElementById('island-status').innerText = `Ligação em ${countdown}s...`;
            countdown--;
            state.scheduledCallTimeout = setTimeout(updateCountdown, 1000);
        } else {
            island.classList.remove('expanded');
            triggerCallNow(contact);
        }
    };
    
    updateCountdown();
    navigateTo('screen-contacts'); // Volta para contatos, simulando que o celular está em espera
}

// ================= RESPOSTAS DA CHAMADA (ACEITAR / RECUSAR) =================
function acceptIncomingCall() {
    stopRingtone();
    
    state.isCalling = false;
    state.isActiveCall = true;
    state.callDuration = 0;

    // Configurar tela ativa
    document.getElementById('active-caller-name').innerText = `${state.selectedContact.firstName} ${state.selectedContact.lastName}`;
    
    const bg = document.getElementById('active-blur-bg');
    bg.style.backgroundColor = state.selectedContact.color || '#111116';

    document.getElementById('call-timer-text').innerText = '00:00';
    document.getElementById('speaker-tag').classList.remove('visible');
    document.getElementById('active-btn-speaker').classList.remove('active');
    state.isSpeakerActive = false;

    navigateTo('screen-active');

    // Iniciar timer
    state.timerInterval = setInterval(() => {
        state.callDuration++;
        document.getElementById('call-timer-text').innerText = getFormattedDuration();
        
        // Atualizar Dynamic Island
        document.getElementById('island-status').innerText = `${state.selectedContact.firstName} • ${getFormattedDuration()}`;
    }, 1000);

    // Começar voz simulada
    startFakeVoice();
}

function declineIncomingCall() {
    stopRingtone();
    if ('vibrate' in navigator) {
        navigator.vibrate(0);
    }
    state.isCalling = false;
    navigateTo('screen-contacts');
}

function hangupCall() {
    stopFakeVoice();
    
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    state.isActiveCall = false;
    turnScreenOn(); // Força tela a ligar se estiver apagada
    
    navigateTo('screen-contacts');
}

function getFormattedDuration() {
    const mins = String(Math.floor(state.callDuration / 60)).padStart(2, '0');
    const secs = String(state.callDuration % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

// ================= VOZ DA CHAMADA (TEXT-TO-SPEECH) =================
function startFakeVoice() {
    if (!state.selectedContact) return;
    
    const audioType = state.selectedContact.audioType || 'none';
    if (audioType === 'none') return;

    let textToSpeak = VOICE_PRESETS[audioType];
    if (audioType === 'tts') {
        textToSpeak = document.getElementById('tts-text-input').value.trim() || VOICE_PRESETS.boss;
    }

    if ('speechSynthesis' in window) {
        // Cancela qualquer voz que esteja tocando antes
        window.speechSynthesis.cancel();

        state.speechUtterance = new SpeechSynthesisUtterance(textToSpeak);
        state.speechUtterance.lang = 'pt-BR';
        
        // Simular fone de ouvido (volume menor no início, se alto-falante estiver desativado)
        state.speechUtterance.volume = state.isSpeakerActive ? 1.0 : 0.15;
        
        // Configurações para soar mais natural e sutil
        state.speechUtterance.rate = 1.0; 
        state.speechUtterance.pitch = 1.0;

        window.speechSynthesis.speak(state.speechUtterance);
    }
}

function stopFakeVoice() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

function adjustFakeVoiceVolume(volume) {
    if (state.speechUtterance && 'speechSynthesis' in window) {
        // Infelizmente no meio da fala de algumas APIs de TTS o volume é imutável dinamicamente,
        // mas para garantir, recriamos a fala se a pessoa mudar o alto-falante para melhor simulação
        if (window.speechSynthesis.speaking) {
            const currentText = state.speechUtterance.text;
            window.speechSynthesis.cancel();
            
            state.speechUtterance = new SpeechSynthesisUtterance(currentText);
            state.speechUtterance.lang = 'pt-BR';
            state.speechUtterance.volume = volume;
            window.speechSynthesis.speak(state.speechUtterance);
        }
    }
}

// ================= CONTROLES DO SENSOR DE PROXIMIDADE =================
function turnScreenOff() {
    const blackout = document.getElementById('blackout-screen');
    blackout.classList.add('active');
}

function turnScreenOn() {
    const blackout = document.getElementById('blackout-screen');
    blackout.classList.remove('active');
}

// Inicializar e escutar os eventos dos Sensores
function initProximityEvents() {
    // 1. Hover na Dynamic Island ou topo da tela (Testes no Desktop)
    const island = document.getElementById('dynamic-island');
    island.addEventListener('mouseenter', () => {
        if (state.settings.hover && state.isActiveCall) {
            turnScreenOff();
        }
    });

    document.querySelector('.iphone-status-bar').addEventListener('mouseenter', () => {
        if (state.settings.hover && state.isActiveCall) {
            turnScreenOff();
        }
    });

    // 2. Giroscópio / Acelerômetro (Giro e Inclinação da Orelha)
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (event) => {
            if (!state.settings.gyro || !state.isActiveCall) return;

            const beta = event.beta; // Inclinação frente/trás (0 é plano na mesa, 90 é de pé)
            const gamma = event.gamma; // Inclinação esquerda/direita
            
            document.getElementById('debug-gyro-val').innerText = `${Math.round(beta || 0)}°`;

            // Se o celular estiver em pé, inclinado como se estivesse na orelha (normalmente > 75° ou < -75°)
            if (beta && (Math.abs(beta) > 75 && Math.abs(beta) < 105)) {
                turnScreenOff();
            } else {
                // Caso contrário, acende
                turnScreenOn();
            }
        });
    } else {
        document.getElementById('debug-gyro-val').innerText = 'Incompatível';
    }
}

// Checa suporte para Proximity API nativa do navegador (historicamente Firefox Mobile ou Chromium com flags)
function checkProximityAPISupport() {
    const debugAPI = document.getElementById('debug-proximity-api');
    
    if ('ProximitySensor' in window) {
        debugAPI.innerText = 'Disponível';
        try {
            const sensor = new ProximitySensor({ frequency: 10 });
            sensor.addEventListener('reading', () => {
                if (state.isActiveCall) {
                    if (sensor.distance < sensor.max) {
                        turnScreenOff();
                    } else {
                        turnScreenOn();
                    }
                }
            });
            sensor.start();
        } catch (e) {
            console.warn("Sensor de Proximidade nativo deu erro ao iniciar: ", e);
        }
    } else {
        debugAPI.innerText = 'Não suportado (Usando emulação)';
    }
}
