import { Box, Group, Image, Paper, Progress, Stack, Text } from '@mantine/core';
import { useQrFrames } from '../hooks/useQrFrames';

export function QrDisplay({ frames, label }: { frames: string[]; label: string }) {
  const { index, dataUrl } = useQrFrames(frames);
  const total = Math.max(frames.length, 1);
  return (
    <Stack gap="sm" align="center">
      <Paper className="qr-shell" radius="xl" p="sm" withBorder>
        {dataUrl ? <Image src={dataUrl} alt={label} w="min(72vw, 310px)" h="min(72vw, 310px)" /> : <Box w={280} h={280} />}
      </Paper>
      <Group gap="xs" justify="center">
        <Text size="sm" c="dimmed">{label}</Text>
        {frames.length > 1 && <Text size="sm" fw={650}>{index + 1}/{frames.length}</Text>}
      </Group>
      {frames.length > 1 && <Progress value={((index + 1) / total) * 100} w="min(68vw, 280px)" radius="xl" size="xs" />}
      {frames.length > 1 && <Text size="xs" c="dimmed" ta="center">Код меняется сам. Второй телефон соберёт все части по очереди.</Text>}
    </Stack>
  );
}
