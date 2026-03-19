import type { UiIconName } from "../types";

export function UiIcon({ name }: { name: UiIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "upload":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 13V4m0 0-3 3m3-3 3 3M4 14v2h12v-2" /></svg>;
    case "plus":
    case "addRow":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 4v12M4 10h12" /></svg>;
    case "menu":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M3 5h14M3 10h14M3 15h14" /></svg>;
    case "settings":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 3v2m0 10v2m7-7h-2M5 10H3m11.95-4.95-1.4 1.4M6.45 13.55l-1.4 1.4m0-9.9 1.4 1.4m8.1 8.1 1.4 1.4M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
    case "cursor":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 3v13l3-3 2 4 2-1-2-4h4z" /></svg>;
    case "shapeLine":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 14 16 6" /></svg>;
    case "shapeArrow":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m4 14 9-9m0 0h-4m4 0v4" /></svg>;
    case "shapeRect":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><rect {...common} x="4" y="5" width="12" height="10" rx="2" ry="2" /></svg>;
    case "shapePolygon":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 3 16 8 13.5 16h-7L4 8z" /></svg>;
    case "shapeText":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 5h12M10 5v10m-3 0h6" /></svg>;
    case "magnet":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M6 4v6a4 4 0 1 0 8 0V4m-8 0h3m2 0h3" /></svg>;
    case "login":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M8 5H4v10h4m4-7 3 2-3 2m3-2H7" /></svg>;
    case "logout":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M12 5h4v10h-4m-4-7-3 2 3 2m-3-2h8" /></svg>;
    case "userPlus":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M13 16v-1a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v1m5-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7 1v4m-2-2h4" /></svg>;
    case "send":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m3 10 13-6-3 12-3-5-7-1Z" /></svg>;
    case "check":
    case "apply":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m4 10 4 4 8-8" /></svg>;
    case "undo":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M7 7H3v4m0-4 3 3a6 6 0 1 0 1-5" /></svg>;
    case "save":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 4h10l2 2v10H4zM7 4v5h6V4M7 16v-4h6v4" /></svg>;
    case "history":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M3 10a7 7 0 1 0 2-5M3 5v4h4M10 7v4l3 2" /></svg>;
    case "delete":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10" /></svg>;
    case "copy":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M7 7h9v9H7zM4 13H3V4h9v1" /></svg>;
    case "arrowLeft":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M12 4 6 10l6 6M6 10h10" /></svg>;
    case "arrowRight":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m8 4 6 6-6 6m6-6H4" /></svg>;
    case "pdf":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M5 3h7l3 3v11H5zM12 3v3h3M7 13h1.4a1.3 1.3 0 0 0 0-2.6H7V15m3-2h2.4m-2.4 2v-4.6h2.6M14 15v-4.6h2.4" /></svg>;
    case "refresh":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M16 10a6 6 0 1 1-1.5-4M16 4v4h-4" /></svg>;
    case "up":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m5 12 5-5 5 5" /></svg>;
    case "down":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m5 8 5 5 5-5" /></svg>;
    case "photo":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M3 5h4l1-2h4l1 2h4v11H3zM6 13l2-2 2 2 3-3 2 3" /></svg>;
    case "clear":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m5 5 10 10M15 5 5 15" /></svg>;
    case "lock":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M5 9h10v8H5zM7 9V7a3 3 0 0 1 6 0v2" /></svg>;
    case "template":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 4h12v12H4zM4 8h12M8 8v8" /></svg>;
    case "crop":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M6 3v11a2 2 0 0 0 2 2h9M3 6h11a2 2 0 0 1 2 2v9M6 6h8v8H6z" /></svg>;
    default:
      return <svg viewBox="0 0 20 20" aria-hidden="true"><circle {...common} cx="10" cy="10" r="6" /></svg>;
  }
}
