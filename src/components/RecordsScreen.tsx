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
        <Stack gap={1} className="records-title-wrap">
          <Title order={2}>Рекорды</Title>
          <Text size="xs" c="dimmed">Только на этом устройстве</Text>
        </Stack>
      </header>

      <Paper withBorder radius="xl" p="lg" className="records-hero">
        <div className="records-hero-head">
          <ThemeIcon size={46} radius="xl" variant="light" color="indigo"><IconTrophy size={23} /></ThemeIcon>
          <div>
            <Text fw={800} fz="lg">Твои результаты</Text>
            <Text size="sm" c="dimmed">{solved.length ? `${solved.length} ${pluralSolved(solved.length)}` : 'Первый рекорд ещё впереди'}</Text>
          </div>
        </div>
        <div className="records-hero-metrics">
          <div className="hero-metric">
            <span className="hero-metric-icon"><IconClock size={17} /></span>
            <div><Text size="xs" c="dimmed">Лучшее время</Text><Text fw={800}>{fastest ? formatTime(fastest.durationMs) : '—'}</Text></div>
          </div>
          <div className="hero-metric">
            <span className="hero-metric-icon"><IconCrown size={17} /></span>
            <div><Text size="xs" c="dimmed">Лучший счёт</Text><Text fw={800}>{bestScore ? formatScore(bestScore.score) : '—'}</Text></div>
          </div>
        </div>
      </Paper>

      <section className="records-section compact-section">
        <Group gap="xs" mb="sm"><IconCrown size={19} /><Text fw={750}>Лучшие по полям</Text></Group>
        <SimpleGrid cols={2} spacing="sm" className="records-size-grid">
          {[9, 12, 15, 18].map((size) => {
            const games = solved.filter((game) => game.size === size);
            const fastestForSize = games.reduce<GameRecord | null>((best, game) => !best || game.durationMs < best.durationMs ? game : best, null);
            const bestForSize = games.reduce<GameRecord | null>((best, game) => !best || game.score > best.score ? game : best, null);
            return (
              <Paper key={size} withBorder radius="xl" p="md" className={`record-size-card ${fastestForSize ? 'has-record' : 'empty-record'}`}>
                <div className="record-size-top">
                  <span className="record-size-badge">{size}×{size}</span>
                  {fastestForSize && <IconCrown size={17} className="record-size-crown" />}
                </div>
                <Text className="record-size-time" fw={800}>{fastestForSize ? formatTime(fastestForSize.durationMs) : '—'}</Text>
                <Text size="xs" c="dimmed" className="record-size-meta">
                  {fastestForSize
                    ? `${difficultyLabels[fastestForSize.difficulty]} · ${formatScore(bestForSize?.score ?? 0)} очков`
                    : 'Пока без результата'}
                </Text>
              </Paper>
            );
          })}
        </SimpleGrid>
      </section>

      <section className="records-section compact-section">
        <Group gap="xs" mb="sm"><IconUsers size={19} /><Text fw={750}>С кем играл</Text></Group>
        {book.partners.length ? (
          <div className="partners-list">
            {book.partners.map((partner) => (
              <Paper key={partner.id} withBorder radius="xl" p="sm" className="partner-card" style={{ '--partner-record-color': playerColorHex[partner.color] } as React.CSSProperties}>
                <span className="partner-avatar">{partner.name.trim().slice(0, 1).toUpperCase() || '•'}</span>
                <div className="partner-copy">
                  <Text fw={750}>{partner.name}</Text>
                  <Text size="xs" c="dimmed">{partner.games ? `${partner.games} ${pluralGames(partner.games)}` : 'Подключались'} · {dateFormatter.format(partner.lastPlayedAt)}</Text>
                </div>
              </Paper>
            ))}
          </div>
        ) : (
          <EmptyCard text="Здесь появятся игроки, с которыми ты сыграешь вдвоём." />
        )}
      </section>

      <section className="records-section compact-section">
        <Group gap="xs" mb="sm"><IconHistory size={19} /><Text fw={750}>Последние партии</Text></Group>
        {book.games.length ? (
          <Paper withBorder radius="xl" className="history-list">
            {book.games.slice(0, 10).map((game) => (
              <div key={game.id} className="history-row">
                <div className={`history-result ${game.outcome}`}>{game.outcome === 'solved' ? '✓' : '×'}</div>
                <div className="history-main">
                  <Text fw={700}>{game.size}×{game.size} · {difficultyLabels[game.difficulty]}</Text>
                  <Text size="xs" c="dimmed">{game.mode === 'duo' ? `Вдвоём${game.partnerName ? ` с ${game.partnerName}` : ''}` : 'Один'} · {formatTime(game.durationMs)} · {game.mistakes} ош.</Text>
                </div>
                <div className="history-score">{formatScore(game.score)}</div>
              </div>
            ))}
          </Paper>
        ) : (
          <EmptyCard text="Завершённые партии появятся здесь автоматически." />
        )}
      </section>
    </main>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <Paper withBorder radius="xl" p="lg" className="records-empty"><Text size="sm" c="dimmed">{text}</Text></Paper>;
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

function pluralSolved(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'решённых полей';
  const mod10 = value % 10;
  if (mod10 === 1) return 'решённое поле';
  if (mod10 >= 2 && mod10 <= 4) return 'решённых поля';
  return 'решённых полей';
}
