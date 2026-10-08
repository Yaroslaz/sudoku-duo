import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function useQrFrames(frames: string[], intervalMs = 1650) {
  const [index, setIndex] = useState(0);
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => setIndex(0), [frames]);

  useEffect(() => {
    if (frames.length <= 1) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % frames.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [frames, intervalMs]);

  useEffect(() => {
    let cancelled = false;
    const frame = frames[index] ?? '';
    if (!frame) {
      setDataUrl('');
      return;
    }
    QRCode.toDataURL(frame, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'L',
      color: { dark: '#10131a', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [frames, index]);

  return { index, dataUrl };
}
