import { Menu, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useRef, useState } from 'react';

export type AdaptiveMenuOption = {
  value: string;
  label: string;
};

export function AdaptiveMenu({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: AdaptiveMenuOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  const scrollYRef = useRef(0);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const preserveScroll = () => {
    scrollYRef.current = window.scrollY;
  };

  const handleOpenedChange = (next: boolean) => {
    if (next) preserveScroll();
    setOpened(next);
    if (next) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollYRef.current, left: 0, behavior: 'auto' });
      });
    }
  };

  return (
    <Menu
      opened={opened}
      onChange={handleOpenedChange}
      position="bottom-start"
      width="target"
      offset={8}
      withinPortal
      trapFocus={false}
      middlewares={{ flip: true, shift: true }}
      transitionProps={{ transition: 'pop', duration: 180 }}
    >
      <Menu.Target>
        <UnstyledButton
          className="difficulty-menu-target"
          aria-label={ariaLabel}
          aria-expanded={opened}
          onPointerDown={preserveScroll}
        >
          <span>{selected?.label ?? ''}</span>
          <IconChevronDown className={opened ? 'adaptive-menu-chevron opened' : 'adaptive-menu-chevron'} size={20} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown className="difficulty-menu-dropdown adaptive-menu-dropdown">
        {options.map((option) => (
          <Menu.Item
            key={option.value}
            onClick={() => onChange(option.value)}
            rightSection={option.value === value ? <IconCheck size={17} /> : null}
            className={option.value === value ? 'difficulty-menu-item active' : 'difficulty-menu-item'}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
