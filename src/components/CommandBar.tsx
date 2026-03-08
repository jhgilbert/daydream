"use client";

import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import { useSlashCommands, type SlashCommand } from "./SlashCommandProvider";
import styles from "./CommandBar.module.css";

export function CommandBar() {
  const { commands } = useSlashCommands();
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchedCommand = parseCommand(value, commands);
  const filteredCommands = getFilteredCommands(value, commands);

  // Show suggestions when input starts with /
  useEffect(() => {
    if (value.startsWith("/")) {
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  }, [value]);

  function parseCommand(
    input: string,
    cmds: SlashCommand[]
  ): SlashCommand | null {
    const match = input.match(/^\/(\S+)\s/);
    if (!match) return null;
    return cmds.find((c) => c.name === match[1]) ?? null;
  }

  function getFilteredCommands(
    input: string,
    cmds: SlashCommand[]
  ): SlashCommand[] {
    if (!input.startsWith("/")) return [];
    const typed = input.slice(1).split(" ")[0].toLowerCase();
    // If a full command has been typed followed by a space, don't show the menu
    if (matchedCommand) return [];
    return cmds.filter((c) => c.name.startsWith(typed));
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;

    const cmdMatch = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/);
    if (cmdMatch) {
      const cmd = commands.find((c) => c.name === cmdMatch[1]);
      if (cmd) {
        cmd.execute(cmdMatch[2] ?? "");
        setValue("");
        setShowSuggestions(false);
        return;
      }
    }
    // If not a recognized command, do nothing for now
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + filteredCommands.length) % filteredCommands.length
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !matchedCommand)) {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        setValue(`/${cmd.name} `);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const placeholder = matchedCommand
    ? `/${matchedCommand.name} ${matchedCommand.argPlaceholder}`
    : "Type / for commands...";

  return (
    <div className={styles.wrapper}>
      {showSuggestions && filteredCommands.length > 0 && (
        <ul className={styles.suggestions} role="listbox">
          {filteredCommands.map((cmd, i) => (
            <li
              key={cmd.name}
              role="option"
              aria-selected={i === selectedIndex}
              className={`${styles.suggestion} ${i === selectedIndex ? styles.suggestionSelected : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(`/${cmd.name} `);
                inputRef.current?.focus();
              }}
            >
              <span className={styles.commandName}>/{cmd.name}</span>
              <span className={styles.commandDesc}>{cmd.description}</span>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onFocus={() => {
          if (value.startsWith("/")) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        className={styles.input}
        aria-label="Command input"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
