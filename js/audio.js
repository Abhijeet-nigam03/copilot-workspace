// ==========================================
// SYNAPSE OS: Web Audio API Synthesizer
// Lo-Fi Rain, Binaural 40Hz Waves, White Noise, Pomodoro Chime
// ==========================================

class AudioSynth {
  constructor() {
    this.ctx = null;
    this.currentMode = null; // 'rain', 'binaural', 'noise'
    this.activeNodes = [];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  stopAll() {
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
    this.currentMode = null;
  }

  playCompletionChime() {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, this.ctx.currentTime + 0.2); // A5
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  }

  toggleAmbient(mode) {
    this.init();
    if (this.currentMode === mode) {
      this.stopAll();
      return null;
    }
    
    this.stopAll();
    this.currentMode = mode;

    if (mode === 'binaural') {
      // 40Hz Gamma Focus Binaural Beats (200Hz in left ear, 240Hz in right)
      const merger = this.ctx.createChannelMerger(2);
      
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);

      oscL.frequency.value = 210;
      oscR.frequency.value = 250;

      oscL.connect(merger, 0, 0); // Left channel
      oscR.connect(merger, 0, 1); // Right channel
      merger.connect(gain);
      gain.connect(this.ctx.destination);

      oscL.start();
      oscR.start();
      this.activeNodes.push(oscL, oscR, gain, merger);

    } else if (mode === 'rain' || mode === 'noise') {
      // Pink / Brown filtered noise for Rain & Focus
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter integration
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      noiseNode.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = mode === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(mode === 'rain' ? 800 : 450, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09, this.ctx.currentTime);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start();
      this.activeNodes.push(noiseNode, filter, gain);
    }

    return this.currentMode;
  }
}

const audioSynth = new AudioSynth();
