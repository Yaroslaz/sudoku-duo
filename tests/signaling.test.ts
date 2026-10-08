import { describe, expect, it } from 'vitest';
import { FrameAssembler, signalToFrames, type SignalPayload } from '../src/multiplayer/signaling';

describe('local QR signaling', () => {
  it('round-trips one compact Base45 QR', async () => {
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
    expect(result.payload?.kind).toBe(payload.kind);
    expect(result.payload?.sdp).toEqual(payload.sdp);
    expect(result.payload?.networkMode).toBe('local');
  });

  it('keeps a realistic local SDP in one QR and strips optional candidate noise', async () => {
    const candidate = 'a=candidate:123456 1 udp 2122260223 192.168.1.12 54876 typ host generation 0 ufrag abc123 network-cost 999';
    const payload: SignalPayload = {
      protocol: 2,
      kind: 'answer',
      sdp: {
        type: 'answer',
        sdp: [
          'v=0',
          'o=- 123456789 2 IN IP4 127.0.0.1',
          's=-',
          't=0 0',
          'a=group:BUNDLE 0',
          'a=msid-semantic: WMS',
          'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
          'c=IN IP4 0.0.0.0',
          candidate,
          'a=ice-ufrag:abc123',
          'a=ice-pwd:abcdefghijklmnopqrstuvwx',
          'a=ice-options:trickle',
          'a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
          'a=setup:active',
          'a=mid:0',
          'a=sctp-port:5000',
          'a=max-message-size:262144',
          '',
        ].join('\r\n'),
      },
      sender: { id: 'device-dense', name: 'Друг', color: 'teal' },
      networkMode: 'local',
    };

    const frames = await signalToFrames(payload);
    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBeLessThan(2850);

    const result = await new FrameAssembler().add(frames[0]);
    const restoredSdp = result.payload?.sdp.sdp ?? '';
    expect(restoredSdp).toContain('a=candidate:123456 1 udp 2122260223 192.168.1.12 54876 typ host');
    expect(restoredSdp).not.toContain('generation 0');
    expect(restoredSdp).not.toContain('network-cost');
    expect(restoredSdp).not.toContain('a=ice-options:trickle');
    expect(restoredSdp).toContain('a=max-message-size:262144');
  });
});
