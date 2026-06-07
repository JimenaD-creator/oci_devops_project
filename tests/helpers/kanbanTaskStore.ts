import fs from 'node:fs';
import path from 'node:path';

export type KanbanTaskRef = { id: number; title: string };

const STORE_PATH = path.join('playwright', '.auth', 'kanban-task-id.json');

export function saveKanbanTaskRef(ref: KanbanTaskRef): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(ref));
}

export function readKanbanTaskRef(): KanbanTaskRef {
  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  return JSON.parse(raw) as KanbanTaskRef;
}
