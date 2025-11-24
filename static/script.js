class JarvisClient {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.meterSource = null;
        this.meterAnalyser = null;
        this.animationFrame = null;
        this.responseAudioUrl = null;

        this.dom = {
            speakButton: document.getElementById('speakButton'),
            personaOrb: document.getElementById('personaOrb'),
            statusText: document.getElementById('statusText'),
            meterBar: document.getElementById('meterBar'),
            transcriptPanel: document.getElementById('transcriptPanel'),
            replayButton: document.getElementById('replayButton'),
            voiceButton: document.getElementById('voiceButton'),
            shareButton: document.getElementById('shareButton'),
            responseAudio: document.getElementById('responseAudio')
        };

        this.bindEvents();
    }

    bindEvents() {
        const startRecording = this.startRecording.bind(this);
        const stopRecording = this.stopRecording.bind(this);

        this.dom.speakButton.addEventListener('mousedown', startRecording);
        this.dom.speakButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRecording();
        });

        const endEvents = ['mouseup', 'mouseleave', 'touchend', 'touchcancel'];
        endEvents.forEach(eventName => {
            this.dom.speakButton.addEventListener(eventName, (e) => {
                if (eventName.startsWith('touch')) e.preventDefault();
                stopRecording();
            });
        });

        this.dom.replayButton.addEventListener('click', () => this.playResponse());
        this.dom.voiceButton.addEventListener('click', () => this.toast('Voice customization coming soon.'));
        this.dom.shareButton.addEventListener('click', () => this.shareTranscript());
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.isRecording = true;

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            });

            this.mediaRecorder.addEventListener('stop', () => {
                this.processRecording();
            });

            this.setupMeter(stream);

            this.mediaRecorder.start();
            this.updateUIForRecording(true);
        } catch (error) {
            console.error('Microphone access denied or unavailable:', error);
            this.toast('Jarvis needs microphone access to help. Please enable mic permissions.');
        }
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        this.mediaRecorder.stop();
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.isRecording = false;

        this.cleanupMeter();
        this.updateUIForRecording(false);
    }

    setupMeter(stream) {
        this.audioContext = new AudioContext();
        this.meterSource = this.audioContext.createMediaStreamSource(stream);
        this.meterAnalyser = this.audioContext.createAnalyser();
        this.meterAnalyser.fftSize = 512;

        this.meterSource.connect(this.meterAnalyser);
        this.animateMeter();
    }

    animateMeter() {
        const bufferLength = this.meterAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.meterAnalyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
            const intensity = Math.min(100, (average / 255) * 140);

            this.dom.meterBar.style.width = `${intensity}%`;
            this.animationFrame = requestAnimationFrame(draw);
        };

        this.animationFrame = requestAnimationFrame(draw);
    }

    cleanupMeter() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.meterSource) this.meterSource.disconnect();
        if (this.meterAnalyser) this.meterAnalyser.disconnect();
        if (this.audioContext) this.audioContext.close();

        this.dom.meterBar.style.width = '0%';
    }

    updateUIForRecording(recording) {
        if (recording) {
            this.dom.speakButton.classList.add('recording');
            this.dom.personaOrb.classList.add('listening');
            this.dom.statusText.textContent = 'Jarvis is listening…';
        } else {
            this.dom.speakButton.classList.remove('recording');
            this.dom.personaOrb.classList.remove('listening');
            this.dom.statusText.textContent = 'Jarvis is analyzing your request…';
        }
    }

    async processRecording() {
        if (!this.audioChunks.length) {
            this.dom.statusText.textContent = 'Jarvis is standing by. Tap when you’re ready.';
            return;
        }

        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'input.webm');

        try {
            const response = await fetch('/api/interact', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Server error');
            }

            const payload = await response.json();
            this.presentResult(payload);
        } catch (error) {
            console.error('Interaction failed:', error);
            this.toast(`Jarvis hit a snag: ${error.message}`);
            this.dom.statusText.textContent = 'Jarvis is standing by. Tap when you’re ready.';
        }
    }

    presentResult({ user_text, ai_response, audio_url }) {
        if (user_text) {
            this.pushMessage(user_text, 'user');
        }
        if (ai_response) {
            this.pushMessage(ai_response, 'ai');
        }

        if (audio_url) {
            this.responseAudioUrl = audio_url;
            this.dom.responseAudio.src = audio_url;
            this.dom.responseAudio.play().catch(() => {
                this.toast('Response ready – tap replay to listen.');
            });
        }

        this.dom.replayButton.disabled = !audio_url;
        this.dom.voiceButton.disabled = false;
        this.dom.shareButton.disabled = false;
        this.dom.statusText.textContent = 'Jarvis is standing by. Tap when you’re ready.';
    }

    pushMessage(text, type) {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        this.dom.transcriptPanel.appendChild(message);
        this.dom.transcriptPanel.scrollTo({ top: this.dom.transcriptPanel.scrollHeight, behavior: 'smooth' });
    }

    playResponse() {
        if (!this.responseAudioUrl) return;
        this.dom.responseAudio.currentTime = 0;
        this.dom.responseAudio.play().catch(() => {
            this.toast('Unable to play audio automatically. Tap replay again.');
        });
    }

    async shareTranscript() {
        const messages = [...document.querySelectorAll('.message')]
            .map(el => el.textContent)
            .join('\n\n');

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Jarvis Conversation',
                    text: messages
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    this.toast('Sharing cancelled.');
                }
            }
        } else {
            await navigator.clipboard.writeText(messages);
            this.toast('Transcript copied to clipboard.');
        }
    }

    toast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        Object.assign(toast.style, {
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: 'var(--accent-gradient)',
            color: '#101726',
            padding: '0.85rem 1.25rem',
            borderRadius: '14px',
            fontWeight: '600',
            boxShadow: '0 8px 24px rgba(253, 160, 133, 0.35)',
            zIndex: 9999,
            opacity: 0,
            transform: 'translateY(-10px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease'
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JarvisClient();
});