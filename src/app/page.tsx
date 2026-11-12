import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export default async function Page() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  let html = await readFile(filePath, "utf8");

  const routingScript = `
<script>
(function(){
  // Validation nav → /dashboard
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-module-link="validation"]');
    if(t){ e.preventDefault(); e.stopPropagation(); window.location.href = '/dashboard'; return; }
  }, true);
  function checkHash(){
    if(window.location.hash === '#/validation'){ window.location.href = '/dashboard'; }
  }
  window.addEventListener('hashchange', checkHash);
  setTimeout(checkHash, 100);

  // Add nav buttons: Feed + Pricing
  var navLinks = document.querySelector('.nav-links');
  if(navLinks){
    // Feed
    var feedBtn = document.createElement('a');
    feedBtn.href = '/feed';
    feedBtn.style.cssText = 'font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;background:transparent;border:1px solid transparent;color:var(--fg-dim);padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .22s';
    feedBtn.innerHTML = '<i class="fas fa-globe" style="font-size:10px;opacity:.85"></i><span class="nav-label">Feed</span>';
    feedBtn.addEventListener('mouseenter', function(){ feedBtn.style.color='var(--fg)'; feedBtn.style.background='var(--bg-card)'; });
    feedBtn.addEventListener('mouseleave', function(){ feedBtn.style.color='var(--fg-dim)'; feedBtn.style.background='transparent'; });
    navLinks.appendChild(feedBtn);

    // Pricing
    var priceBtn = document.createElement('a');
    priceBtn.href = '/pricing';
    priceBtn.style.cssText = 'font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;background:transparent;border:1px solid transparent;color:var(--fg-dim);padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .22s';
    priceBtn.innerHTML = '<i class="fas fa-tags" style="font-size:10px;opacity:.85"></i><span class="nav-label">Pricing</span>';
    priceBtn.addEventListener('mouseenter', function(){ priceBtn.style.color='var(--fg)'; priceBtn.style.background='var(--bg-card)'; });
    priceBtn.addEventListener('mouseleave', function(){ priceBtn.style.color='var(--fg-dim)'; priceBtn.style.background='transparent'; });
    navLinks.appendChild(priceBtn);
  }

  // Update "100% Founder-Owned" → "100% of shares owned by founder"
  document.body.innerHTML = document.body.innerHTML.replace(/100% Founder-Owned/g, '100% of shares owned by founder');
  document.body.innerHTML = document.body.innerHTML.replace(/100% founder-owned/gi, '100% of shares owned by founder');
})();
</script>`;

  html = html + routingScript;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
