import { Alert, Button, Paper, Stack, Text, TextInput } from '@mantine/core';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { formatRoomCode, isRoomCode, normalizeRoomCode } from '../multiplayer/signaling';

export function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
    const start = async () => {
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current!,
          (result) => {
            if (!result || stopped) return;
            const code = normalizeRoomCode(result.getText());
            if (!isRoomCode(code)) {
              setError('Это не код комнаты Sudoku duo');
              return;
            }
            controlsRef.current?.stop();
            onCode(code);
          },
        );
      } catch {
        setError('Не удалось открыть камеру. Введи короткий код комнаты ниже.');
      }
    };
    if (videoRef.current) void start();
    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onCode]);

  const applyManual = () => {
    const code = normalizeRoomCode(manual);
    if (!isRoomCode(code)) {
      setError('Введи все 6 символов кода');
      return;
    }
    onCode(code);
  };

  return (
    <Stack gap="md">
      <Paper className="scanner-shell" radius="xl" withBorder>
        <video ref={videoRef} className="scanner-video" muted playsInline />
        <div className="scanner-frame" aria-hidden="true" />
      </Paper>
      <Stack gap="xs">
        <Text size="sm" fw={650}>Или введи код</Text>
        <TextInput
          value={formatRoomCode(manual)}
          onChange={(event: { currentTarget: HTMLInputElement }) => setManual(normalizeRoomCode(event.currentTarget.value))}
          placeholder="m7k-4qp"
          size="lg"
          radius="lg"
          maxLength={7}
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="text"
          className="room-code-input"
        />
        <Button onClick={applyManual} disabled={!isRoomCode(manual)} radius="xl" size="md">Подключиться</Button>
      </Stack>
      {error && <Alert color="red" radius="lg">{error}</Alert>}
    </Stack>
  );
}
