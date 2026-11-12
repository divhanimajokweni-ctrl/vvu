import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Serve the unified console HTML as-is. A small script is appended
// that intercepts the "validation" module link → redirects to /dashboard
// and adds a community feed nav button → redirects to /feed.
// The HTML itself is not modified.
export default async function Page() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  let html = await readFile(filePath, "utf8");

  const routingScript = `
<script>
(function(){
  // Intercept validation module → /dashboard
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-module-link="validation"]');
    if(t){
      e.preventDefault();
      e.stopPropagation();
      window.location.href = '/dashboard';
      return;
    }
  }, true);

  // Handle hash: if #/validation, redirect to /dashboard
  function checkHash(){
    if(window.location.hash === '#/validation'){
      window.location.href = '/dashboard';
    }
  }
  window.addEventListener('hashchange', checkHash);
  setTimeout(checkHash, 100);

  // Add a community feed nav button to the nav-links
  var navLinks = document.querySelector('.nav-links');
  if(navLinks){
    var feedBtn = document.createElement('a');
    feedBtn.href = '/feed';
    feedBtn.style.cssText = 'font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;background:transparent;border:1px solid transparent;color:var(--fg-dim);padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .22s';
    feedBtn.innerHTML = '<i class="fas fa-globe" style="font-size:10px;opacity:.85"></i><span class="nav-label">Feed</span>';
    feedBtn.addEventListener('mouseenter', function(){
      feedBtn.style.color = 'var(--fg)';
      feedBtn.style.background = 'var(--bg-card)';
    });
    feedBtn.addEventListener('mouseleave', function(){
      feedBtn.style.color = 'var(--fg-dim)';
      feedBtn.style.background = 'transparent';
    });
    navLinks.appendChild(feedBtn);
  }
})();
</script>`;

  html = html + routingScript;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
