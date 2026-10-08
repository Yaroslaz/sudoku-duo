import { Alert, Button, Group, Paper, Progress, Stack, Text, Textarea } from '@mantine/core';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { copyCodeToSignal, FrameAssembler, type FrameProgress, type SignalPayload } from '../multiplayer/signaling';

export function QrScanner({ onSignal, expectedKind }: { onSignal: (signal: SignalPayload) => void; expectedKind: 'offer' | 'answer' }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const assembler = useMemo(() => new FrameAssembler(), []);
  const [progress, setProgress] = useState<FrameProgress | null>(null);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 250 });
    const start = async () => {
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current!,
          async (result) => {
            if (!result || stopped) return;
            try {
              const assembled = await assembler.add(result.getText());
              if (assembled.progress) setProgress(assembled.progress);
              if (assembled.payload) {
                if (assembled.payload.kind !== expectedKind) throw new Error('Это код другого шага подключения');
                controlsRef.current?.stop();
                onSignal(assembled.payload);
              }
            } catch (scanError) {
              setError(scanError instanceof Error ? scanError.message : 'Не удалось прочитать код');
            }
          },
        );
      } catch (cameraError) {
        setError('Не удалось открыть камеру. Разреши доступ к камере или вставь код вручную.');
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
    try {
      const signal = await copyCodeToSignal(manual);
      if (signal.kind !== expectedKind) throw new Error('Это код другого шага подключения');
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
      {progress && (
        <Stack gap={5}>
          <Group justify="space-between"><Text size="sm">Собираю код</Text><Text size="sm" fw={650}>{progress.received}/{progress.total}</Text></Group>
          <Progress value={(progress.received / progress.total) * 100} radius="xl" />
        </Stack>
      )}
      {error && <Alert color="red" radius="lg">{error}</Alert>}
      <Button variant="subtle" onClick={() => setManualOpen((value) => !value)}>{manualOpen ? 'Скрыть ручной ввод' : 'Вставить код вручную'}</Button>
      {manualOpen && (
        <Stack gap="xs">
          <Textarea value={manual} onChange={(event: { currentTarget: HTMLTextAreaElement }) => setManual(event.currentTarget.value)} minRows={4} autosize placeholder="Вставь код, который скопирован на втором телефоне" />
          <Button onClick={() => void applyManual()} disabled={!manual.trim()}>Применить код</Button>
        </Stack>
      )}
    </Stack>
  );
}
