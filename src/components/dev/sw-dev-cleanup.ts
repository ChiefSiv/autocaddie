// DEV-ONLY service-worker teardown.
//
// Why this exists: the prod build ships a Serwist service worker (public/sw.js)
// that, once registered on an origin (e.g. localhost from a `npm start`), keeps
// CONTROLLING that origin and serving its precached JS chunks — even after you
// `rm -rf .next` and start `npm run dev`. The dev config only DISABLES
// registering a *new* SW; it never unregisters an already-active one. The result
// is the dev server's fresh code never reaches the browser: you execute stale
// chunks (symptom we hit: "queryKeys.crewPlayers is not a function", with a stack
// line that doesn't match the committed source).
//
// This inline script runs before hydration in development and unregisters any
// active SW + clears its caches, then reloads ONCE (sessionStorage-guarded so it
// can't loop) so the un-intercepted dev bundle loads. In production this script
// is not emitted, so the real SW is untouched.
//
// NOTE: if a stale SW is *already* serving an old app shell, that shell won't
// contain this script — so the very first recovery still needs a one-time manual
// unregister (DevTools → Application → Service Workers → Unregister, or Clear
// site data). After one clean load this guard prevents recurrence.
export const SW_DEV_CLEANUP_SCRIPT = `(function(){
  try {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function(regs){
      var had = regs.length > 0;
      regs.forEach(function(r){ r.unregister(); });
      if (window.caches && caches.keys) {
        caches.keys().then(function(keys){ keys.forEach(function(k){ caches.delete(k); }); });
      }
      if (had && !sessionStorage.getItem('ac-sw-dev-cleared')) {
        sessionStorage.setItem('ac-sw-dev-cleared','1');
        location.reload();
      }
    }).catch(function(){});
  } catch (e) {}
})();`;
