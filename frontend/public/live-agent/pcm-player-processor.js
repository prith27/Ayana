/**
 * An audio worklet processor that stores the PCM audio data sent from the main thread
 * to a buffer and plays it.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.bufferSize = 24000 * 180;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.playbackIdle = true;

    this.port.onmessage = (event) => {
      if (event.data.command === "endOfAudio") {
        this.readIndex = this.writeIndex;
        this._setPlaybackIdle(true);
        return;
      }

      const int16Samples = new Int16Array(event.data);
      this._enqueue(int16Samples);
    };
  }

  _enqueue(int16Samples) {
    if (int16Samples.length > 0) {
      this._setPlaybackIdle(false);
    }

    for (let i = 0; i < int16Samples.length; i++) {
      const floatVal = int16Samples[i] / 32768;
      this.buffer[this.writeIndex] = floatVal;
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;

      if (this.writeIndex === this.readIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }
  }

  _setPlaybackIdle(nextIdle) {
    if (this.playbackIdle === nextIdle) {
      return;
    }

    this.playbackIdle = nextIdle;
    this.port.postMessage({
      type: "playback_state",
      idle: nextIdle,
    });
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const framesPerBlock = output[0].length;

    for (let frame = 0; frame < framesPerBlock; frame++) {
      output[0][frame] = this.buffer[this.readIndex];
      if (output.length > 1) {
        output[1][frame] = this.buffer[this.readIndex];
      }

      if (this.readIndex !== this.writeIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }

    if (this.readIndex === this.writeIndex) {
      this._setPlaybackIdle(true);
    }

    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
