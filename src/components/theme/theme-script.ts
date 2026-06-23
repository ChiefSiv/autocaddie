// Runs synchronously before paint (injected in <body> top by the root layout)
// so the correct theme is applied before React hydrates — no flash of wrong theme.
// Stored value is one of "light" | "dark" | "system"; "system" follows the OS via
// the prefers-color-scheme rules in globals.css.
export const THEME_STORAGE_KEY = "autocaddie-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","system");}})();`;
