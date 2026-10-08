import { Box, Group, Image, Paper, Progress, Stack, Text } from '@mantine/core';
import { useQrFrames } from '../hooks/useQrFrames';

export function QrDisplay({ frames, label }: { frames: string[]; label: string }) {
  const { index, dataUrl } = useQrFrames(frames, 1650);
  const total = Math.max(frames.length, 1);
  return (
    <Stack gap="sm" align="center">
      <Paper className="qr-shell" radius="xl" p={8} withBorder>
        {dataUrl ? <Image src={dataUrl} alt={label} w="min(64vw, 260px)" h="min(64vw, 260px)" /> : <Box w={240} h={240} />}
      </Paper>
      <Group gap="xs" justify="center">
        <Text size="sm" c="dimmed">{label}</Text>
        {frames.length > 1 && <Text size="sm" fw={650}>{index + 1}/{frames.length}</Text>}
      </Group>
      {frames.length > 1 && <Progress value={((index + 1) / total) * 100} w="min(68vw, 280px)" radius="xl" size="xs" />}
      {frames.length > 1 && <Text size="xs" c="dimmed" ta="center">QR разделён на несколько простых частей, поэтому квадраты крупнее. Просто держи второй телефон на экране — части сменятся сами.</Text>}
    </Stack>
  );
}
