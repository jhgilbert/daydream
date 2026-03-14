"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import styles from "./NoteEditor.module.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface NoteEditorProps {
  initialValue: string;
  onSave: (html: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function NoteEditor({ initialValue, onSave, onCancel, onDirtyChange }: NoteEditorProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    // Quill may transform empty strings to "<p><br></p>" on mount,
    // so normalize both sides before comparing
    const normalize = (html: string) => html.replace(/<[^>]*>/g, "").trim();
    const isDirty = normalize(value) !== normalize(initialValue);
    onDirtyChange?.(isDirty);
  }, [value, initialValue, onDirtyChange]);

  const handleSave = useCallback(() => {
    onSave(value);
  }, [value, onSave]);

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
