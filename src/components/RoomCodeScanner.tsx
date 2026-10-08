import { Alert, Paper, Stack } from '@mantine/core';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { parseRoomCodeQrValue } from '../multiplayer/internetPeer';

export function RoomCodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 300 });
    const start = async () => {
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current!,
          (result) => {
            if (!result || stopped) return;
            const code = parseRoomCodeQrValue(result.getText());
            if (!code) {
              setError('Это не QR с кодом комнаты Sudoku duo');
              return;
            }
            controlsRef.current?.stop();
            onCode(code);
          },
        );
      } catch {
        setError('Не удалось открыть камеру. Разреши доступ к камере или введи 5 цифр вручную.');
      }
    };
    if (videoRef.current) void start();
    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onCode]);

  return (
    <Stack gap="md">
      <Paper className="scanner-shell" radius="xl" withBorder>
        <video ref={videoRef} className="scanner-video" muted playsInline />
        <div className="scanner-frame" aria-hidden="true" />
      </Paper>
      {error && <Alert color="red" radius="lg">{error}</Alert>}
    </Stack>
  );
}
