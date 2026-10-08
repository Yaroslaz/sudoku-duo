import { FrameAssembler, signalToFrames, type SignalPayload } from '../src/multiplayer/signaling';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  let state = 123456789;
  const noisy = Array.from({ length: 12000 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return String.fromCharCode(33 + (state % 90));
  }).join('');
  const candidate = `a=x-test:${noisy}\r\n`;
  const signal: SignalPayload = {
    protocol: 1,
    kind: 'offer',
    sdp: { type: 'offer', sdp: `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n${candidate}` },
    sender: { id: 'device-a', name: 'Ярослав' },
    networkMode: 'local',
  };

  const frames = await signalToFrames(signal);
  assert(frames.length > 1, 'large signal must be split into multiple QR frames');
  assert(frames.every((frame) => frame.length < 1200), 'each QR frame must stay comfortably below the QR payload limit');

  const assembler = new FrameAssembler();
  const order = frames.map((_, index) => index).reverse();
  let restored: SignalPayload | null = null;
  for (const index of order) {
    const result = await assembler.add(frames[index]);
    if (result.payload) restored = result.payload;
  }

  assert(restored !== null, 'all frames must reconstruct a signal');
  assert(restored.sender.name === signal.sender.name, 'unicode player name must survive round trip');
  assert(restored.sdp.sdp === signal.sdp.sdp, 'SDP must survive compression and frame assembly exactly');
  console.log(`Signaling check passed with ${frames.length} QR frame(s).`);
}

void main();
