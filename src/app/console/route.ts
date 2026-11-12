import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Serve the unified console HTML verbatim. This is a complete standalone
// HTML file (238KB, 4689 lines) with inline CSS + JS. It's the landing
// page — everything goes under it.
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  const html = await readFile(filePath, "utf8");
  const navigationScript = `<script>
(function(){
  document.addEventListener('click', function(event){
    const target = event.target instanceof Element
      ? event.target.closest('[data-module-link="validation"]')
      : null;
    if(target){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/dashboard');
    }
  }, true);
  function routeValidationHash(){
    if(window.location.hash === '#/validation') window.location.assign('/dashboard');
  }
  routeValidationHash();
  window.addEventListener('hashchange', routeValidationHash);

  const navLinks = document.querySelector('#mainNav .nav-links');
  if(!navLinks) return;
  for(const item of [{href:'/feed', icon:'fa-globe', label:'Feed'}, {href:'/pricing', icon:'fa-tags', label:'Pricing'}]){
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'nav-external-link';
    const icon = document.createElement('i');
    icon.className = 'fas ' + item.icon;
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = item.label;
    link.append(icon, label);
    navLinks.appendChild(link);
  }
})();
</script>`;
  const responseHtml = html.replace('</body>', `${navigationScript}</body>`);
  return new NextResponse(responseHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
