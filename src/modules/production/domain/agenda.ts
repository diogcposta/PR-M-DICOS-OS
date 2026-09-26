/**
 * Vista de agenda de um dia: slots gerados a partir do horário e ocupação real.
 * A agenda é derivada (consultas + faltas registadas); não há marcações próprias.
 */
import { intervalsOverlap, type TimeInterval } from "./time";

export type AgendaBlock = TimeInterval;

export interface AgendaEvent extends TimeInterval {
  readonly kind: "session" | "absence";
  readonly label: string;
  readonly detail?: string;
  readonly href?: string;
}

export interface AgendaSlot extends TimeInterval {
  readonly events: AgendaEvent[];
  readonly state: "free" | "worked" | "absence" | "mixed";
}

/**
 * Slots consecutivos dentro de cada bloco do horário. Um resto menor que o slot
 * no fim de um bloco é mostrado como slot curto — nunca escondido.
 */
export function buildSlots(blocks: readonly AgendaBlock[], slotMinutes: number): TimeInterval[] {
  if (slotMinutes <= 0) return [];
  const slots: TimeInterval[] = [];
  for (const block of [...blocks].sort((a, b) => a.startMinute - b.startMinute)) {
    for (let start = block.startMinute; start < block.endMinute; start += slotMinutes) {
      slots.push({ startMinute: start, endMinute: Math.min(start + slotMinutes, block.endMinute) });
    }
  }
  return slots;
}

export function fillSlots(slots: readonly TimeInterval[], events: readonly AgendaEvent[]): AgendaSlot[] {
  return slots.map((slot) => {
    const hits = events.filter((e) => intervalsOverlap(slot, e));
    const kinds = new Set(hits.map((e) => e.kind));
    const state: AgendaSlot["state"] =
      hits.length === 0 ? "free" : kinds.size > 1 ? "mixed" : kinds.has("session") ? "worked" : "absence";
    return { ...slot, events: hits, state };
  });
}
