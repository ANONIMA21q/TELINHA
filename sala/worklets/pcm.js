// Toca no Telinha o som de um programa só: recebe PCM 16 bits estéreo 48 kHz e entrega numa faixa.
class TelinhaPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 48000 * 2; // 1 s de áudio estéreo
    this.buf = new Float32Array(this.size);
    this.r = 0; this.w = 0; this.n = 0;
    this.port.onmessage = (e) => {
      const s = new Int16Array(e.data);
      for (let i = 0; i < s.length; i++) { this.buf[this.w] = s[i] / 32768; this.w = (this.w + 1) % this.size; }
      this.n = Math.min(this.n + s.length, this.size);
      // atraso máximo 250 ms: se acumular, pula pra ficar em ~80 ms
      if (this.n > 24000) { const drop = this.n - 7680; this.r = (this.r + drop) % this.size; this.n -= drop; }
    };
  }
  process(_inputs, outputs) {
    const L = outputs[0][0], R = outputs[0][1] || outputs[0][0];
    for (let i = 0; i < L.length; i++) {
      if (this.n >= 2) { L[i] = this.buf[this.r]; R[i] = this.buf[(this.r + 1) % this.size]; this.r = (this.r + 2) % this.size; this.n -= 2; }
      else { L[i] = 0; R[i] = 0; }
    }
    return true;
  }
}
registerProcessor('telinha-pcm', TelinhaPcm);
