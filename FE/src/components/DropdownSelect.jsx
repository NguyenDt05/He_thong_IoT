import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./DropdownSelect.css";

function DropdownSelect({ value, options, onChange, ariaLabel, variant = "default" }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex] ?? options[0];

  useLayoutEffect(() => {
    if (!open) return;

    function positionMenu() {
      const anchor = variant === "filter"
        ? rootRef.current?.closest(".filter")
        : triggerRef.current;
      const rect = anchor?.getBoundingClientRect();
      if (!rect) return;

      const gap = 6;
      const below = window.innerHeight - rect.bottom - gap - 8;
      const above = rect.top - gap - 8;
      const wantedHeight = Math.min(260, options.length * 36 + 8);
      const placeBelow = below >= wantedHeight || below >= above;
      const maxHeight = Math.max(0, Math.min(260, placeBelow ? below : above));

      setMenuPosition({
        left: rect.left,
        top: placeBelow ? rect.bottom + gap : rect.top - gap - Math.min(wantedHeight, maxHeight),
        width: rect.width,
        maxHeight,
      });
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, options.length, variant]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event) {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open || !menuPosition) return;
    const menu = menuRef.current;
    const option = optionRefs.current[activeIndex];
    if (!menu || !option) return;

    if (option.offsetTop < menu.scrollTop) {
      menu.scrollTop = option.offsetTop;
    } else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
    }
  }, [open, menuPosition, activeIndex]);

  function openMenu() {
    setActiveIndex(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function choose(index) {
    if (options[index].value !== value) onChange?.(options[index].value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((index) => (index + direction + options.length) % options.length);
      }
      return;
    }
    if (!open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const query = event.key.toLocaleLowerCase();
      const match = options.findIndex((option, index) =>
        index > activeIndex && option.label.toLocaleLowerCase().startsWith(query));
      const wrappedMatch = match < 0
        ? options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(query))
        : match;
      if (wrappedMatch >= 0) setActiveIndex(wrappedMatch);
    }
  }

  return (
    <div className={`dropdown dropdown--${variant}`} ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => open ? setOpen(false) : openMenu()}
      >
        <span className="dropdown-value">{selected?.label}</span>
        <svg className="dropdown-arrow" viewBox="0 0 12 8" aria-hidden="true">
          <path d="m1 1 5 5 5-5" />
        </svg>
      </button>
      {open && menuPosition && createPortal(
        <div
          id={listId}
          ref={menuRef}
          className="dropdown-menu"
          role="listbox"
          aria-label={ariaLabel}
          style={menuPosition}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              id={`${listId}-${index}`}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              className="dropdown-option"
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex || undefined}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default DropdownSelect;
