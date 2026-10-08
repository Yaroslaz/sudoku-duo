const GUARD_KEY = 'sudokuDuoBackGuard';
let allowExit = false;
let installed = false;

function pushGuard() {
  if (history.state?.[GUARD_KEY]) return;
  history.pushState({ ...(history.state ?? {}), [GUARD_KEY]: true }, '');
}

function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  element.click();
  return true;
}

function handleTopModal() {
  const modal = document.querySelector<HTMLElement>('.mantine-Modal-root');
  if (!modal) return false;

  const homeButton = Array.from(modal.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.trim() === 'На главный экран');
  if (homeButton) {
    homeButton.click();
    return true;
  }

  const closeButton = modal.querySelector<HTMLElement>('.mantine-Modal-close');
  if (closeButton) {
    closeButton.click();
    return true;
  }

  return false;
}

export function installBackNavigation() {
  if (installed) return;
  installed = true;

  if (!history.state?.[GUARD_KEY]) {
    history.replaceState({ ...(history.state ?? {}), sudokuDuoBase: true }, '');
    history.pushState({ [GUARD_KEY]: true }, '');
  }

  window.addEventListener('popstate', () => {
    if (allowExit) {
      allowExit = false;
      history.back();
      return;
    }

    pushGuard();

    if (handleTopModal()) return;
    if (click('.solo-setup-view [aria-label="Назад"]')) return;
    if (click('.records-screen .records-back')) return;
    if (click('.pairing-screen [aria-label="Назад"]')) return;
    if (click('.reference-game [aria-label="Выйти из игры"]')) return;

    const shouldExit = window.confirm('Выйти из Sudoku duo?');
    if (!shouldExit) return;

    allowExit = true;
    history.back();
  });
}
