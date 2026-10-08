import { describe, expect, it } from 'vitest';
import { FrameAssembler, signalToFrames, type SignalPayload } from '../src/multiplayer/signaling';

describe('local QR signaling', () => {
  it('round-trips the compact Base45 QR format', async () => {
    const payload: SignalPayload = {
      protocol: 2,
      kind: 'offer',
      sdp: {
        type: 'offer',
        sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:test\r\na=ice-pwd:secret\r\na=fingerprint:sha-256 11:22:33:44\r\n',
      },
      sender: { id: 'device-123', name: 'Игрок', color: 'blue' },
      networkMode: 'local',
    };

    const frames = await signalToFrames(payload);
    expect(frames).toHaveLength(1);
    expect(frames[0].startsWith('S2')).toBe(true);
    expect(frames[0]).toMatch(/^[0-9A-Z $%*+\-./:]+$/);

    const result = await new FrameAssembler().add(frames[0]);
    expect(result.payload).toEqual(payload);
  });

  it('splits dense signaling into easier QR parts and assembles them in any order', async () => {
    let state = 0x12345678;
    const noisy = Array.from({ length: 7000 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return String.fromCharCode(33 + (state % 90));
    }).join('');
    const payload: SignalPayload = {
      protocol: 2,
      kind: 'answer',
      sdp: { type: 'answer', sdp: `v=0\r\na=x-test:${noisy}\r\n` },
      sender: { id: 'device-dense', name: 'Друг', color: 'teal' },
      networkMode: 'local',
    };

    const frames = await signalToFrames(payload);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every((frame) => frame.length < 850)).toBe(true);

    const assembler = new FrameAssembler();
    let restored: SignalPayload | null = null;
    for (const frame of [...frames].reverse()) {
      const result = await assembler.add(frame);
      if (result.payload) restored = result.payload;
    }
    expect(restored).toEqual(payload);
  });
});
