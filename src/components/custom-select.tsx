"use client";

import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import * as React from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function firstEnabledIndex(options: readonly SelectOption[]) {
  const index = options.findIndex((option) => !option.disabled);
  return index >= 0 ? index : 0;
}

export function CustomSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select…",
  name,
  disabled = false,
  size = "md",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel: string;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [position, setPosition] = React.useState<MenuPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const typeaheadResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeaheadRef = React.useRef("");
  const listboxId = React.useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 42 + 8, 256);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openAbove = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
    const available = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(96, Math.min(256, available));
    const renderedHeight = Math.min(estimatedHeight, maxHeight);

    setPosition({
      top: openAbove ? Math.max(8, rect.top - renderedHeight - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      maxHeight,
    });
  }, [options.length]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onViewportChange = () => updatePosition();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updatePosition]);

  React.useEffect(() => () => {
    if (typeaheadResetRef.current) clearTimeout(typeaheadResetRef.current);
  }, []);

  function nextEnabled(from: number, direction: 1 | -1) {
    if (options.length === 0) return 0;
    let index = from;
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return from;
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openMenu() {
    setActiveIndex(
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : firstEnabledIndex(options)
    );
    updatePosition();
    setOpen(true);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        openMenu();
      } else {
        setActiveIndex((index) => nextEnabled(index, direction));
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      if (!open) return;
      event.preventDefault();
      const start = event.key === "Home" ? -1 : options.length;
      setActiveIndex(nextEnabled(start, event.key === "Home" ? 1 : -1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else openMenu();
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadResetRef.current) clearTimeout(typeaheadResetRef.current);
      typeaheadResetRef.current = setTimeout(() => {
        typeaheadRef.current = "";
      }, 600);
      const match = options.findIndex(
        (option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(typeaheadRef.current)
      );
      if (match >= 0) {
        event.preventDefault();
        if (!open) {
          updatePosition();
          setOpen(true);
        }
        setActiveIndex(match);
      }
    }
  }

  return (
    <div className={`relative w-full ${className}`}>
      {name && <input type="hidden" name={name} value={value} readOnly />}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={onKeyDown}
        className={`${size === "sm" ? "h-9 px-2.5 text-sm" : "h-11 px-3.5 text-[15px]"} flex w-full items-center justify-between gap-3 rounded-(--r-sm) border border-control-border bg-control-bg text-left text-ink-1 transition-colors hover:border-ink-4 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-ink-3"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && position && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
          className="z-[100] overflow-y-auto rounded-(--r-sm) border border-line bg-surface-1 p-1 shadow-[0_12px_32px_rgba(28,28,26,0.14)]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                tabIndex={-1}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => choose(index)}
                className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-[calc(var(--r-sm)-2px)] px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  isActive ? "bg-surface-2 text-ink-1" : "text-ink-2 hover:bg-surface-2 hover:text-ink-1"
                } ${isSelected ? "font-medium text-brand" : ""}`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={15} strokeWidth={2} className="shrink-0 text-brand" aria-hidden="true" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
