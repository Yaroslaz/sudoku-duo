import { Box, Image, Paper, Stack, Text } from '@mantine/core';
import { useQrFrames } from '../hooks/useQrFrames';

export function QrDisplay({ frames, label }: { frames: string[]; label: string }) {
  const { dataUrl } = useQrFrames(frames, 1650);
  return (
    <Stack gap={6} align="center">
      <Paper className="qr-shell compact-qr-shell" radius="lg" p={6} withBorder>
        {dataUrl ? <Image src={dataUrl} alt={label} w="min(54vw, 220px)" h="min(54vw, 220px)" /> : <Box w={210} h={210} />}
      </Paper>
      <Text size="xs" c="dimmed">{label}</Text>
    </Stack>
  );
}
