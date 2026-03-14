"use client";

import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import {
  useSlashCommands,
  type SlashCommand,
  type InteractivePrompt,
  type ArgSuggestion,
} from "./SlashCommandProvider";
import styles from "./CommandBar.module.css";

interface InteractiveState {
  command: SlashCommand;
  prompts: InteractivePrompt[];
  currentIndex: number;
  answers: Record<string, string>;
}

export function CommandBar() {
  const { commands } = useSlashCommands();
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [argSelectedIndex, setArgSelectedIndex] = useState(0);
  const [interactive, setInteractive] = useState<InteractiveState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { todos } = useSlashCommands();
  const matchedCommand = parseCommand(value, commands);
  const filteredCommands = getFilteredCommands(value, commands);
  const visibleTodos = todos.filter((t) => !t.deleted);
  const refTodos = matchedCommand?.filterTaskReference
    ? visibleTodos.filter(matchedCommand.filterTaskReference)
    : visibleTodos;
  const showTaskRef = matchedCommand?.showTaskReference && refTodos.length > 0;

  // Arg-level suggestions
  const argInput = matchedCommand ? value.replace(/^\/\S+\s/, "") : "";
  const argSuggestions: ArgSuggestion[] =
    matchedCommand?.getArgSuggestions?.(argInput) ?? [];
  const showArgSuggestions =
    matchedCommand?.getArgSuggestions != null && argSuggestions.length > 0;

  // Show suggestions when input starts with /
  useEffect(() => {
    if (value.startsWith("/")) {
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  }, [value]);

  // Reset arg selection when suggestions change
  useEffect(() => {
    setArgSelectedIndex(0);
  }, [argInput]);

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

  function selectArgSuggestion(suggestion: ArgSuggestion) {
    setValue(`/${matchedCommand!.name} ${suggestion.value}`);
    inputRef.current?.focus();
  }

  function handleSubmit() {
    // Interactive mode: advance through prompts
    if (interactive) {
      const prompt = interactive.prompts[interactive.currentIndex];
      const answer = value.trim();

      // If required and empty, re-ask
      if (prompt.required && !answer) return;

      const updatedAnswers = { ...interactive.answers, [prompt.key]: answer };
      const nextIndex = interactive.currentIndex + 1;

      if (nextIndex < interactive.prompts.length) {
        // Advance to next prompt
        setInteractive({
          ...interactive,
          currentIndex: nextIndex,
          answers: updatedAnswers,
        });
        setValue("");
      } else {
        // All prompts collected — execute
        interactive.command.executeInteractive?.(updatedAnswers);
        setInteractive(null);
        setValue("");
      }
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) return;

    const cmdMatch = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/);
    if (cmdMatch) {
      const cmd = commands.find((c) => c.name === cmdMatch[1]);
      if (cmd) {
        const args = cmdMatch[2] ?? "";
        // If no args and command has interactive prompts, enter interactive mode
        if (
          !args &&
          cmd.interactivePrompts &&
          cmd.interactivePrompts.length > 0 &&
          cmd.executeInteractive
        ) {
          setInteractive({
            command: cmd,
            prompts: cmd.interactivePrompts,
            currentIndex: 0,
            answers: {},
          });
          setValue("");
          setShowSuggestions(false);
          return;
        }
        const result = cmd.execute(args);
        // If execute returns prompts, enter interactive mode
        if (Array.isArray(result)) {
          setInteractive({
            command: cmd,
            prompts: result,
            currentIndex: 0,
            answers: {},
          });
          setValue("");
          setShowSuggestions(false);
          return;
        }
        setValue("");
        setShowSuggestions(false);
        return;
      }
    }
    // If not a recognized command, do nothing for now
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Arg-level suggestion navigation
    if (showArgSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setArgSelectedIndex((i) => (i + 1) % argSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setArgSelectedIndex(
          (i) => (i - 1 + argSuggestions.length) % argSuggestions.length
        );
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        selectArgSuggestion(argSuggestions[argSelectedIndex]);
        return;
      }
    }

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
      if (interactive) {
        setInteractive(null);
        setValue("");
      }
      setShowSuggestions(false);
    }
  }

  const placeholder = interactive
    ? interactive.prompts[interactive.currentIndex].question
    : matchedCommand
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
              <div className={styles.commandHeader}>
                <span className={styles.commandName}>/{cmd.name}</span>
                <span className={styles.commandDesc}>{cmd.description}</span>
              </div>
              <div className={styles.commandUsage}>
                /{cmd.name} {cmd.argPlaceholder}
              </div>
            </li>
          ))}
        </ul>
      )}
      {showArgSuggestions && (
        <ul className={styles.suggestions} role="listbox">
          {argSuggestions.map((s, i) => (
            <li
              key={`${s.value}-${i}`}
              role="option"
              aria-selected={i === argSelectedIndex}
              className={`${styles.argSuggestion} ${i === argSelectedIndex ? styles.suggestionSelected : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectArgSuggestion(s);
              }}
            >
              <span className={styles.argSuggestionLabel}>{s.label}</span>
              <span className={styles.argSuggestionHint}>Tab to select</span>
            </li>
          ))}
        </ul>
      )}
      {showTaskRef && (
        <ul className={styles.taskReference}>
          {refTodos.map((todo, i) => (
            <li key={todo.id} className={styles.taskRefItem}>
              <span className={styles.taskRefNumber}>{i + 1}</span>
              <span className={todo.done ? styles.taskRefTextDone : styles.taskRefText}>{todo.text}</span>
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
