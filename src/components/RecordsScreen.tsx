import { ActionIcon, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconArrowLeft, IconClock, IconCrown, IconHistory, IconTrophy, IconUsers } from '@tabler/icons-react';
import { difficultyLabels } from '../game/engine';
import { loadRecordBook, type GameRecord } from '../game/records';
import { playerColorHex } from '../game/playerColors';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

export function RecordsScreen({ onBack }: { onBack: () => void }) {
  const book = loadRecordBook();
  const solved = book.games.filter((game) => game.outcome === 'solved');
  const bestScore = solved.reduce<GameRecord | null>((best, game) => !best || game.score > best.score ? game : best, null);
  const fastest = solved.reduce<GameRecord | null>((best, game) => !best || game.durationMs < best.durationMs ? game : best, null);

  return (
    <main className="records-screen">
      <header className="records-header">
        <ActionIcon variant="default" radius="xl" size={42} onClick={onBack} aria-label="Назад" className="records-back"><IconArrowLeft size={21} /></ActionIcon>
        <Stack gap={0} className="records-title-wrap">
          <Title order={2}>Рекорды</Title>
          <Text size="sm" c="dimmed">Хранятся только на этом устройстве</Text>
        </Stack>
      </header>

      <SimpleGrid cols={3} spacing="sm" className="records-summary">
        <SummaryCard icon={<IconTrophy size={20} />} value={String(solved.length)} label="Решено" />
        <SummaryCard icon={<IconCrown size={20} />} value={bestScore ? formatScore(bestScore.score) : '—'} label="Лучший счёт" />
        <SummaryCard icon={<IconClock size={20} />} value={fastest ? formatTime(fastest.durationMs) : '—'} label="Лучшее время" />
      </SimpleGrid>

      <section className="records-section">
        <Group gap="xs" mb="sm"><IconCrown size={19} /><Text fw={750}>Лучшие по полям</Text></Group>
        <Stack gap="sm">
          {[9, 12, 15, 18].map((size) => {
            const games = solved.filter((game) => game.size === size);
            const fastestForSize = games.reduce<GameRecord | null>((best, game) => !best || game.durationMs < best.durationMs ? game : best, null);
            const bestForSize = games.reduce<GameRecord | null>((best, game) => !best || game.score > best.score ? game : best, null);
            return (
              <Paper key={size} withBorder radius="lg" p="md" className="record-row">
                <div className="record-size-badge">{size}×{size}</div>
                <div className="record-row-main">
                  <Text fw={700}>{fastestForSize ? formatTime(fastestForSize.durationMs) : 'Пока нет результата'}</Text>
                  <Text size="xs" c="dimmed">{fastestForSize ? `${difficultyLabels[fastestForSize.difficulty]} · лучший счёт ${formatScore(bestForSize?.score ?? 0)}` : 'Заверши поле, чтобы появился рекорд'}</Text>
                </div>
              </Paper>
            );
          })}
        </Stack>
      </section>

      <section className="records-section">
        <Group gap="xs" mb="sm"><IconUsers size={19} /><Text fw={750}>С кем играл</Text></Group>
        {book.partners.length ? (
          <Stack gap="sm">
            {book.partners.map((partner) => (
              <Paper key={partner.id} withBorder radius="lg" p="md" className="partner-row">
                <span className="partner-color" style={{ background: playerColorHex[partner.color] }} />
                <div className="partner-copy">
                  <Text fw={700}>{partner.name}</Text>
                  <Text size="xs" c="dimmed">{partner.games ? `${partner.games} ${pluralGames(partner.games)}` : 'Подключались'} · {dateFormatter.format(partner.lastPlayedAt)}</Text>
                </div>
              </Paper>
            ))}
          </Stack>
        ) : (
          <EmptyCard text="Здесь появятся игроки, с которыми ты подключался по локальной сети." />
        )}
      </section>

      <section className="records-section">
        <Group gap="xs" mb="sm"><IconHistory size={19} /><Text fw={750}>Последние партии</Text></Group>
        {book.games.length ? (
          <Stack gap="sm">
            {book.games.slice(0, 12).map((game) => (
              <Paper key={game.id} withBorder radius="lg" p="md" className="history-row">
                <div className={`history-result ${game.outcome}`}>{game.outcome === 'solved' ? '✓' : '×'}</div>
                <div className="history-main">
                  <Text fw={700}>{game.size}×{game.size} · {difficultyLabels[game.difficulty]}</Text>
                  <Text size="xs" c="dimmed">{game.mode === 'duo' ? `Вдвоём${game.partnerName ? ` с ${game.partnerName}` : ''}` : 'Один'} · {formatTime(game.durationMs)} · {game.mistakes} ош.</Text>
                </div>
                <div className="history-score">{formatScore(game.score)}</div>
              </Paper>
            ))}
          </Stack>
        ) : (
          <EmptyCard text="Завершённые партии появятся здесь автоматически." />
        )}
      </section>
    </main>
  );
}

function SummaryCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Paper withBorder radius="lg" p="sm" className="summary-card">
      <ThemeIcon variant="light" color="indigo" radius="xl" size={34}>{icon}</ThemeIcon>
      <Text fw={800} className="summary-value">{value}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Paper>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <Paper withBorder radius="lg" p="lg"><Text size="sm" c="dimmed">{text}</Text></Paper>;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatScore(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function pluralGames(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'совместных игр';
  const mod10 = value % 10;
  if (mod10 === 1) return 'совместная игра';
  if (mod10 >= 2 && mod10 <= 4) return 'совместные игры';
  return 'совместных игр';
}
