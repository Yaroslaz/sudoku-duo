import { Box, Image, Paper, Stack, Text } from '@mantine/core';
import { useQrFrames } from '../hooks/useQrFrames';

export function QrDisplay({ frames, label }: { frames: string[]; label: string }) {
  const { dataUrl } = useQrFrames(frames, 1650);
  return (
    <Stack gap={8} align="center">
      <Paper className="qr-shell compact-qr-shell" radius="lg" p={8} withBorder>
        {dataUrl ? <Image src={dataUrl} alt={label} w="min(76vw, 310px)" h="min(76vw, 310px)" /> : <Box w={290} h={290} />}
      </Paper>
      <Text size="xs" c="dimmed">{label}</Text>
    </Stack>
  );
}
