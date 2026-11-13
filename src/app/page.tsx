import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export default async function Page() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  const html = await readFile(filePath, "utf8");

  const script = `
<script>
(function(){
  // Only intercept the VALIDATION nav button
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-module-link="validation"]');
    if(t){ e.preventDefault(); window.location.href = '/dashboard'; }
  }, true);

  // Handle hash: if #/validation, redirect
  window.addEventListener('hashchange', function(){
    if(window.location.hash === '#/validation'){ window.location.href = '/dashboard'; }
  });

  // Add nav buttons: Feed, Pricing, PE Analysis
  var navLinks = document.querySelector('.nav-links');
  if(navLinks){
    var makeNav = function(href, icon, label){
      var btn = document.createElement('a');
      btn.href = href;
      btn.style.cssText = 'font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;background:transparent;border:1px solid transparent;color:var(--fg-dim);padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .22s';
      btn.innerHTML = '<i class="fas fa-' + icon + '" style="font-size:10px;opacity:.85"></i><span class="nav-label">' + label + '</span>';
      btn.addEventListener('mouseenter', function(){ btn.style.color='var(--fg)'; btn.style.background='var(--bg-card)'; });
      btn.addEventListener('mouseleave', function(){ btn.style.color='var(--fg-dim)'; btn.style.background='transparent'; });
      navLinks.appendChild(btn);
    };
    makeNav('/feed', 'globe', 'Feed');
    makeNav('/pricing', 'tags', 'Pricing');
    makeNav('/pe-analysis', 'chart-area', 'PE Analysis');
  }
})();
</script>
</body>`;

  const result = html.replace('</body>', script);
  return <div dangerouslySetInnerHTML={{ __html: result }} />;
}
