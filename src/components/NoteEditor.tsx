"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import styles from "./NoteEditor.module.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface NoteEditorProps {
  initialValue: string;
  initialTitle: string;
  onSave: (html: string, title: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function NoteEditor({ initialValue, initialTitle, onSave, onCancel, onDirtyChange }: NoteEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    // Quill may transform empty strings to "<p><br></p>" on mount,
    // so normalize both sides before comparing
    const normalize = (html: string) => html.replace(/<[^>]*>/g, "").trim();
    const notesDirty = normalize(value) !== normalize(initialValue);
    const titleDirty = title !== initialTitle;
    onDirtyChange?.(notesDirty || titleDirty);
  }, [value, initialValue, title, initialTitle, onDirtyChange]);

  const handleSave = useCallback(() => {
    onSave(value, title.trim());
  }, [value, title, onSave]);

  const modules = {
    toolbar: [
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"],
    ],
  };

  return (
    <div className={styles.container} onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        className={styles.titleInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
      />
      <ReactQuill
        theme="snow"
        value={value}
        onChange={setValue}
        modules={modules}
        placeholder="Add notes..."
      />
      <div className={styles.actions}>
        <button className={styles.saveButton} onClick={handleSave}>
          Save
        </button>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Whether the note content has meaningful text (not just empty HTML tags) */
export function isNoteEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  // Strip HTML tags and check if anything remains
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text.length === 0;
}
