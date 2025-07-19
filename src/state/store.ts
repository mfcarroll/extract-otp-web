import { MigrationOtpParameter } from "../types";

/**
 * Defines the shape of our application's state.
 * This is the "single source of truth".
 */
export interface AppState {
  otps: MigrationOtpParameter[];
  theme: "light" | "dark" | "system";
}

const state: AppState = {
  otps: [],
  theme: (localStorage.getItem("theme") as AppState["theme"]) || "system",
};

type Listener = (state: AppState) => void;
const listeners: Set<Listener> = new Set();

/**
 * Updates the state and notifies all subscribed listeners.
 * @param updater A function that receives the current state and returns an object with the properties to update.
 */
export function setState(
  updater: (currentState: AppState) => Partial<AppState>
) {
  const updates = updater(state);
  Object.assign(state, updates);
  listeners.forEach((listener) => listener(state));
}

/**
 * Returns a read-only snapshot of the current state.
 */
export function getState(): Readonly<AppState> {
  return { ...state };
}

/**
 * Subscribes a listener function to state changes.
 * @param listener The function to call when the state changes.
 * @returns An `unsubscribe` function to remove the listener.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
