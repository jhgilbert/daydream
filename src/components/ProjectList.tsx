"use client";

import { useRef, useState } from "react";
import { useSlashCommands } from "./SlashCommandProvider";
import styles from "./ProjectList.module.css";

export function ProjectList() {
  const { projects, reorderProjects } = useSlashCommands();
  const [open, setOpen] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLLIElement | null>(null);

  function handleDragStart(e: React.DragEvent<HTMLLIElement>, index: number) {
    setDragIndex(index);
    dragNode.current = e.currentTarget;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNode.current) {
        dragNode.current.style.opacity = "0.4";
      }
    });
  }

  function handleDragOver(e: React.DragEvent<HTMLLIElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex === null || dragIndex === index) return;
    setOverIndex(index);
  }

  function handleDragEnd() {
    if (dragNode.current) {
      dragNode.current.style.opacity = "1";
    }
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      reorderProjects(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNode.current = null;
  }

  function getItemClass(index: number) {
    if (dragIndex !== null && overIndex === index && dragIndex !== index) {
      return `${styles.item} ${styles.itemDropTarget}`;
    }
    return styles.item;
  }

  return (
    <section className={styles.container}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className={open ? styles.toggleOpen : styles.toggle}>&#9654;</span>
        <h2 className={styles.heading}>Projects</h2>
      </button>
      {open && (
        projects.length > 0 ? (
          <ul className={styles.list}>
            {projects.map((project, index) => (
              <li
                key={project.id}
                className={getItemClass(index)}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => {
                  if (overIndex === index) setOverIndex(null);
                }}
                onDragEnd={handleDragEnd}
                onDrop={(e) => e.preventDefault()}
              >
                <span className={styles.dragHandle}>&#8942;&#8942;</span>
                <span className={styles.bullet} />
                <span className={styles.name}>{project.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            No projects yet. Use /project to add one.
          </p>
        )
      )}
    </section>
  );
}
