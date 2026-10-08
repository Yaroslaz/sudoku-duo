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
});
