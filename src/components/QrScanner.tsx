import { Alert, Button, Paper, Stack, Text, Textarea } from '@mantine/core';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { copyCodeToSignal, FrameAssembler, type SignalPayload } from '../multiplayer/signaling';

export function QrScanner({ onSignal, expectedKind }: { onSignal: (signal: SignalPayload) => void; expectedKind: 'offer' | 'answer' }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const assembler = useMemo(() => new FrameAssembler(), []);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 300 });

    const start = async () => {
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current!,
          async (result) => {
            if (!result || stopped) return;
            try {
              const assembled = await assembler.add(result.getText());
              if (!assembled.payload) {
                setError('Это не QR соединения Sudoku duo');
                return;
              }
              if (assembled.payload.kind !== expectedKind) throw new Error('Это QR другого шага подключения');
              controlsRef.current?.stop();
              onSignal(assembled.payload);
            } catch (scanError) {
              setError(scanError instanceof Error ? scanError.message : 'Не удалось прочитать QR');
            }
          },
        );
      } catch {
        setError('Не удалось открыть камеру. Разреши доступ к камере или вставь резервный код вручную.');
      }
    };

    if (videoRef.current) void start();
    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      assembler.reset();
    };
  }, [assembler, expectedKind, onSignal]);

  const applyManual = async () => {
    setError('');
    try {
      const signal = await copyCodeToSignal(manual);
      if (signal.kind !== expectedKind) throw new Error('Это код другого шага подключения');
      controlsRef.current?.stop();
      onSignal(signal);
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : 'Не удалось прочитать код');
    }
  };

  return (
    <Stack gap="md">
      <Paper className="scanner-shell" radius="xl" withBorder>
        <video ref={videoRef} className="scanner-video" muted playsInline />
        <div className="scanner-frame" aria-hidden="true" />
      </Paper>

      {error && <Alert color="red" radius="lg">{error}</Alert>}

      <Button variant="subtle" radius="xl" onClick={() => setManualOpen((value) => !value)}>
        {manualOpen ? 'Скрыть ручной ввод' : 'QR не читается — вставить код'}
      </Button>

      {manualOpen && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">На другом телефоне нажми «Скопировать резервный код» и передай его любым локальным способом.</Text>
          <Textarea value={manual} onChange={(event) => setManual(event.currentTarget.value)} minRows={3} autosize placeholder="Вставь резервный код" />
          <Button radius="xl" onClick={() => void applyManual()} disabled={!manual.trim()}>Применить код</Button>
        </Stack>
      )}
    </Stack>
  );
}
