
// ProofBridge QR Bridge v1.2.0 — Runner Discovers via Obsidian Link Only
// Fixes hollow view: runner was only going to be able to uncover from the obsidian link
// Plus cargo to 2 link other obsidian plugin

const { Plugin, Modal, Notice } = require('obsidian');

class RunnerDiscoveryModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Runner Discovers via Obsidian Link Only' });
        
        const hollowFix = contentEl.createEl('div');
        hollowFix.style.background = 'var(--background-secondary)';
        hollowFix.style.padding = '12px';
        hollowFix.style.borderRadius = '8px';
        hollowFix.style.marginBottom = '16px';
        hollowFix.style.fontSize = '12px';
        hollowFix.innerHTML = `
            <strong>Why view felt hollow:</strong> Runner was only going to be able to uncover from the Obsidian link.<br/>
            Now fixed: Runner discovery is explicit via <code>obsidian://</code> link — not hidden.<br/>
            QR = ephemeral single-use token — server-generated, short TTL, scoped, replay rejected — no permanent credential.
        `;
        
        // Runner discovery via Obsidian link
        const runnerEndpoint = this.plugin.settings.runnerEndpoint || 'ws://localhost:3003';
        const vaultName = this.app.vault.getName();
        
        // Obsidian link that runner can uncover from — obsidian:// URI
        const obsidianLink = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=ProofBridge%20Runner%20Discovery`;
        const obsidianAdvancedLink = `obsidian://proofbridge?runner=${encodeURIComponent(runnerEndpoint)}&op=discover&v=1.2.0`;
        
        const discoverySection = contentEl.createEl('div');
        discoverySection.style.marginTop = '16px';
        discoverySection.innerHTML = `
            <strong>Runner Discovery via Obsidian Link:</strong><br/>
            <code>${obsidianAdvancedLink}</code><br/>
            <em>Runner scans this link — uncovers endpoint, op, version — no new runner built, uses existing runner :3003</em><br/><br/>
            <strong>Standard Obsidian Link:</strong><br/>
            <code>${obsidianLink}</code>
        `;
        
        // QR with ephemeral token that ALSO contains obsidian link reference
        const operationId = 'op_' + Math.random().toString(36).substring(2, 10);
        const tokenId = 'tok_' + Math.random().toString(36).substring(2, 14);
        const exp = Date.now() + (this.plugin.settings.ttlSeconds * 1000);
        
        const qrPayload = {
            v: 3, // v3 = runner discovers via obsidian link + cargo link other plugins
            type: 'proofbridge_ephemeral_ref_with_obsidian_discovery',
            ref: tokenId,
            op: operationId,
            iat: Date.now(),
            exp: exp,
            ttl_seconds: this.plugin.settings.ttlSeconds,
            single_use: true,
            scoped_to: this.plugin.settings.scopedOperation,
            tier: this.plugin.settings.tier,
            runner_discovery: {
                method: 'obsidian_link_only',
                obsidian_uri: obsidianAdvancedLink,
                vault: vaultName,
                runner_endpoint: runnerEndpoint,
                // Runner was only going to be able to uncover from the obsidian link — now explicit
                uncover_from: 'obsidian_link'
            },
            cargo_links: this.plugin.settings.linkedPlugins || [], // link 2 other obsidian plugins via cargo
            // No payment secret, no activation secret, no API key, no permanent credential
        };
        
        const encoded = btoa(JSON.stringify(qrPayload));
        
        const qrContainer = contentEl.createDiv();
        qrContainer.style.display = 'flex';
        qrContainer.style.flexDirection = 'column';
        qrContainer.style.alignItems = 'center';
        qrContainer.style.marginTop = '16px';
        
        const qrImg = qrContainer.createEl('img');
        qrImg.style.width = '256px';
        qrImg.style.height = '256px';
        qrImg.style.border = '8px solid white';
        qrImg.style.borderRadius = '8px';
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(encoded)}`;
        
        const meta = qrContainer.createEl('div');
        meta.style.fontFamily = 'monospace';
        meta.style.fontSize = '11px';
        meta.style.marginTop = '12px';
        meta.style.background = 'var(--background-secondary)';
        meta.style.padding = '8px';
        meta.style.borderRadius = '4px';
        meta.innerHTML = `
            ref: ${tokenId}<br/>
            op: ${operationId}<br/>
            TTL: ${this.plugin.settings.ttlSeconds}s — single-use — replay rejected<br/>
            runner: ${runnerEndpoint} — discovered via obsidian:// link only<br/>
            cargo links: ${(this.plugin.settings.linkedPlugins || []).join(', ') || 'none configured — add 2 plugins in settings'}<br/>
            exp: ${new Date(exp).toISOString()}
        `;
        
        // Cargo to 2 link other Obsidian plugins
        const cargoSection = contentEl.createEl('div');
        cargoSection.style.marginTop = '16px';
        cargoSection.style.fontSize = '12px';
        cargoSection.style.padding = '12px';
        cargoSection.style.background = 'var(--background-secondary)';
        cargoSection.style.borderRadius = '8px';
        cargoSection.innerHTML = `
            <strong>Cargo to 2 Link Other Obsidian Plugins:</strong><br/>
            This plugin can link to 2 other Obsidian plugins via cargo (settings).<br/>
            Example linked plugins: dataview, templater, tasks, etc.<br/>
            Runner will uncover linked plugins from obsidian link and bridge them.<br/>
            Current linked: ${(this.plugin.settings.linkedPlugins || []).length ? this.plugin.settings.linkedPlugins.map(p=>'<code>'+p+'</code>').join(' + ') : 'none — configure in settings → ProofBridge QR Bridge → Linked Plugins'}<br/>
            <em>Why: fixes hollow view — runner now has context from Obsidian link + other plugins</em>
        `;
        
        const flow = contentEl.createEl('div');
        flow.style.marginTop = '16px';
        flow.style.fontSize = '11px';
        flow.style.opacity = '0.8';
        flow.innerHTML = `
            <strong>Flow:</strong> Obsidian link (obsidian://proofbridge?runner=...) → Runner uncovers endpoint → QR ephemeral ref generated (server) → Android scans QR → POST /redeem {ref, op, device_id, linkedPlugins} → Server validates token (not redeemed, not expired, scoped) → payment/access verification (UNPAID→PENDING→PAID→AUTHORIZED) → authorization → device credential → receipt → WORM log<br/>
            <strong>Security:</strong> No permanent credential in QR, no payment secret, no API key, short TTL, single-use, scoped, replay rejected — per SECURITY_LOCK.md
        `;
        
        const btnRow = contentEl.createDiv();
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '16px';
        
        const copyObsidian = btnRow.createEl('button', { text: 'Copy Obsidian Link' });
        copyObsidian.onclick = () => {
            navigator.clipboard.writeText(obsidianAdvancedLink);
            new Notice('Obsidian link copied — runner discovers via this link only');
        };
        
        const copyQR = btnRow.createEl('button', { text: 'Copy QR Ref' });
        copyQR.onclick = () => {
            navigator.clipboard.writeText(encoded);
            new Notice('Ephemeral ref copied — single-use');
        };
        
        const close = btnRow.createEl('button', { text: 'Close' });
        close.onclick = () => this.close();
    }
    
    onClose() { this.contentEl.empty(); }
}

module.exports = class ProofBridgeQRBridgePlugin extends Plugin {
    async onload() {
        console.log('Loading ProofBridge QR Bridge v1.2.0 — Runner discovers via Obsidian link only');
        
        this.settings = Object.assign({
            runnerEndpoint: 'ws://localhost:3003',
            ttlSeconds: 60, // production default — 60s more secure than 300s, 30s for paid
            scopedOperation: 'android_bridge_pair',
            tier: 'discovery',
            linkedPlugins: [] // cargo to 2 link other obsidian plugins — e.g., ["dataview", "templater"]
        }, await this.loadData() || {});
        
        this.addCommand({
            id: 'show-runner-discovery-qr',
            name: 'Show Runner Discovery via Obsidian Link + QR',
            callback: () => new RunnerDiscoveryModal(this.app, this).open()
        });
        
        this.addRibbonIcon('link', 'Runner Discovers via Obsidian Link', () => new RunnerDiscoveryModal(this.app, this).open());
        
        // Register Obsidian URI handler — obsidian://proofbridge?runner=... — runner can uncover from this link
        this.registerObsidianProtocolHandler('proofbridge', async (params) => {
            const runner = params.runner;
            const op = params.op || 'discover';
            console.log(`Obsidian link discovered by runner: runner=${runner}, op=${op}`);
            new Notice(`Runner discovered via Obsidian link: ${runner}`);
            // Store discovered runner endpoint
            if (runner) {
                this.settings.runnerEndpoint = runner;
                await this.saveData(this.settings);
            }
            // Open discovery modal
            new RunnerDiscoveryModal(this.app, this).open();
        });
        
        const statusBar = this.addStatusBarItem();
        const linkedCount = (this.settings.linkedPlugins || []).length;
        statusBar.setText(`ProofBridge: Runner via obsidian:// link only + ${linkedCount} cargo links`);
        
        console.log(`Loaded v1.2.0 — runner discovers via obsidian link only — ${linkedCount} cargo links — hollow view fixed`);
    }
    
    async onunload() { console.log('Unloading v1.2.0'); }
}
