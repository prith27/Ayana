export interface AudioPlayerResources {
  node: AudioWorkletNode
  context: AudioContext
}

export interface AudioRecorderResources {
  node: AudioWorkletNode
  context: AudioContext
  stream: MediaStream
}

let audioInputSink: ((pcmData: ArrayBuffer) => void) | null = null

export async function requestMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
  })
}

export async function startAudioPlayerWorklet(): Promise<AudioPlayerResources> {
  const context = new AudioContext({ sampleRate: 24_000 })
  await context.audioWorklet.addModule('/live-agent/pcm-player-processor.js')
  await resumeAudioContext(context)

  const node = new AudioWorkletNode(context, 'pcm-player-processor')
  node.connect(context.destination)

  return { node, context }
}

export async function startAudioRecorderWorklet(
  audioRecorderHandler: (pcmData: ArrayBuffer) => void,
  stream?: MediaStream
): Promise<AudioRecorderResources> {
  const context = new AudioContext({ sampleRate: 16_000 })
  await context.audioWorklet.addModule('/live-agent/pcm-recorder-processor.js')
  await resumeAudioContext(context)

  const activeStream = stream ?? await requestMicrophoneStream()
  const source = context.createMediaStreamSource(activeStream)
  const node = new AudioWorkletNode(context, 'pcm-recorder-processor')

  source.connect(node)
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    audioRecorderHandler(convertFloat32ToPCM(event.data))
  }

  return { node, context, stream: activeStream }
}

export function setAudioInputSink(
  sink: ((pcmData: ArrayBuffer) => void) | null
): void {
  audioInputSink = sink
}

export function forwardAudioInput(pcmData: ArrayBuffer): void {
  audioInputSink?.(pcmData)
}

export async function resumeAudioContext(context: AudioContext | null): Promise<void> {
  if (!context || context.state === 'running') {
    return
  }

  try {
    await context.resume()
  } catch (error) {
    console.warn('[live-agent] audio context resume failed', error)
  }
}

export function stopAudioPlayer(resources: AudioPlayerResources | null): void {
  if (!resources) {
    return
  }

  resources.node.disconnect()
  void resources.context.close()
}

export function stopAudioRecorder(resources: AudioRecorderResources | null): void {
  if (!resources) {
    return
  }

  resources.stream.getTracks().forEach((track) => track.stop())
  resources.node.disconnect()
  void resources.context.close()
}

export function base64ToArray(base64: string): ArrayBuffer {
  let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/')
  while (standardBase64.length % 4) {
    standardBase64 += '='
  }

  const binaryString = window.atob(standardBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

function convertFloat32ToPCM(inputData: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(inputData.length)
  for (let i = 0; i < inputData.length; i++) {
    pcm16[i] = inputData[i] * 0x7fff
  }
  return pcm16.buffer
}
