import { describe, expect, it } from 'vitest';
import { FrameAssembler, signalToFrames, type SignalPayload } from '../src/multiplayer/signaling';

const fingerprint = Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(2, '0').toUpperCase()).join(':');

function localPayload(address = '192.168.1.12'): SignalPayload {
  return {
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
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        `a=candidate:123456 1 udp 2122260223 ${address} 54876 typ host generation 0 ufrag abc123 network-cost 999`,
        'a=ice-ufrag:abc123',
        'a=ice-pwd:abcdefghijklmnopqrstuvwx',
        `a=fingerprint:sha-256 ${fingerprint}`,
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
}

describe('local QR signaling', () => {
  it('packs a normal IPv4 LAN connection into a very small single QR', async () => {
    const frames = await signalToFrames(localPayload());

    expect(frames).toHaveLength(1);
    expect(frames[0].startsWith('S4')).toBe(true);
    expect(frames[0]).toMatch(/^[0-9A-Z $%*+\-./:]+$/);
    expect(frames[0].length).toBeLessThan(180);

    const result = await new FrameAssembler().add(frames[0]);
    const restoredSdp = result.payload?.sdp.sdp ?? '';
    expect(result.payload?.kind).toBe('answer');
    expect(restoredSdp).toContain('a=ice-ufrag:abc123');
    expect(restoredSdp).toContain('a=ice-pwd:abcdefghijklmnopqrstuvwx');
    expect(restoredSdp).toContain(`a=fingerprint:sha-256 ${fingerprint}`);
    expect(restoredSdp).toContain('a=setup:active');
    expect(restoredSdp).toContain('192.168.1.12 54876 typ host');
    expect(restoredSdp).not.toContain('generation 0');
    expect(restoredSdp).not.toContain('network-cost');
  });

  it('also keeps an mDNS host candidate compact', async () => {
    const address = '4b3aa17e-7b60-4b9a-a206-7ad64fb7e105.local';
    const frames = await signalToFrames(localPayload(address));

    expect(frames).toHaveLength(1);
    expect(frames[0].startsWith('S4')).toBe(true);
    expect(frames[0].length).toBeLessThan(240);

    const result = await new FrameAssembler().add(frames[0]);
    expect(result.payload?.sdp.sdp).toContain(`${address} 54876 typ host`);
  });

  it('keeps the older textual fallback readable for unusual SDP', async () => {
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

    const result = await new FrameAssembler().add(frames[0]);
    expect(result.payload?.kind).toBe('offer');
    expect(result.payload?.networkMode).toBe('local');
  });
});
