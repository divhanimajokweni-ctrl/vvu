import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export default async function Page() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  const html = await readFile(filePath, "utf8");

  // Inject the routing script BEFORE the closing </body> tag.
  // This script:
  // 1. Redirects validation nav → /dashboard (without blocking other nav clicks)
  // 2. Adds Feed and Pricing nav buttons
  // 3. Does NOT use innerHTML replace (which breaks event listeners)
  const script = `
<script>
(function(){
  // Only intercept the VALIDATION nav button — let all other nav buttons work normally
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-module-link="validation"]');
    if(t){
      e.preventDefault();
      window.location.href = '/dashboard';
    }
  }, true);

  // Handle hash: if #/validation, redirect to /dashboard
  window.addEventListener('hashchange', function(){
    if(window.location.hash === '#/validation'){
      window.location.href = '/dashboard';
    }
  });

  // Add Feed + Pricing nav buttons (without modifying existing buttons)
  var navLinks = document.querySelector('.nav-links');
  if(navLinks){
    var feedBtn = document.createElement('a');
    feedBtn.href = '/feed';
    feedBtn.style.cssText = 'font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;background:transparent;border:1px solid transparent;color:var(--fg-dim);padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .22s';
    feedBtn.innerHTML = '<i class="fas fa-globe" style="font-size:10px;opacity:.85"></i><span class="nav-label">Feed</span>';
    navLinks.appendChild(feedBtn);

    var priceBtn = document.createElement('a');
    priceBtn.href = '/pricing';
    priceBtn.style.cssText = 'font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;background:transparent;border:1px solid transparent;color:var(--fg-dim);padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .22s';
    priceBtn.innerHTML = '<i class="fas fa-tags" style="font-size:10px;opacity:.85"></i><span class="nav-label">Pricing</span>';
    navLinks.appendChild(priceBtn);
  }
})();
</script>
</body>`;

  // Insert the script before </body>, removing the existing </body> first
  const result = html.replace('</body>', script);

  return <div dangerouslySetInnerHTML={{ __html: result }} />;
}
