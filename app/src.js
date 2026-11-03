import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = "0x2d9F945E665F4d3af6Cc7F23ce49C0A3107b2DA2";
const EXPLORER = `https://explorer-studio.genlayer.com/address/${CONTRACT}`;

const $ = (id) => document.getElementById(id);
const log = (msg) => {
  const box = $("log");
  box.textContent = msg;
  box.style.display = "block";
  clearTimeout(log._t);
  log._t = setTimeout(() => (box.style.display = "none"), 10000);
};

const KEY_SLOT = "codereview.keys";
let keys = [];
try { keys = JSON.parse(localStorage.getItem(KEY_SLOT) || "[]"); } catch {}
if (!keys.length) {
  keys = [generatePrivateKey()];
  localStorage.setItem(KEY_SLOT, JSON.stringify(keys));
}
let account = createAccount(keys[0]);
let client = createClient({ chain: studionet, account });
const reader = createClient({ chain: studionet, account: createAccount(generatePrivateKey()) });

async function review() {
  const prUrl = $("prurl").value.trim();
  const focus = $("focus").value;
  if (!prUrl) { log("Enter a PR URL."); return; }

  log("Submitting to GenLayer consensus… (this takes ~1-2 min)");
  $("result").style.display = "none";
  try {
    const hash = await client.writeContract({ address: CONTRACT, functionName: "review_pr", args: [prUrl, focus] });
    log(`Tx: ${hash.slice(0, 12)}… waiting for finalization…`);
    const receipt = await client.waitForTransactionReceipt({ hash, status: "FINALIZED", retries: 200, interval: 3000 });
    if (receipt.result !== 7 && receipt.status !== 7) {
      const lr = (receipt.consensus_data?.leader_receipt || [{}])[0];
      log("Failed: " + (lr.genvm_result?.stderr || "unknown error").slice(0, 200));
      return;
    }
    const stored = await reader.readContract({ address: CONTRACT, functionName: "get_review", args: [prUrl] });
    showResult(stored);
  } catch (e) {
    log("Error: " + (e.message || e));
  }
}

function showResult(r) {
  const box = $("result");
  box.style.display = "block";
  const riskColor = { LOW: "#1f7a4d", MEDIUM: "#9a5b00", HIGH: "#a32b2b", CRITICAL: "#a32b2b" }[r.risk_level] || "#697586";
  const recColor = { APPROVE: "#1f7a4d", REQUEST_CHANGES: "#a32b2b", COMMENT: "#9a5b00" }[r.recommendation] || "#697586";
  let findingsHtml = "";
  if (r.findings && r.findings.length) {
    findingsHtml = "<div style='margin-top:12px'><b>Findings:</b>" + r.findings.map(f =>
      `<div style="padding:8px 0;border-bottom:1px solid #e2e6ec;font-size:13px">
        <span style="font-weight:600;color:${f.severity === 'CRITICAL' || f.severity === 'HIGH' ? '#a32b2b' : '#9a5b00'}">${f.id} [${f.severity}] ${f.category}</span><br/>
        ${f.description}<br/><span style="color:#697586">→ ${f.suggestion}</span>
      </div>`
    ).join("") + "</div>";
  }
  box.innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:12px">
      <div><span style="font-size:28px;font-weight:700">${r.score}/10</span><br/><span style="font-size:12px;color:#697586">Score</span></div>
      <div><span style="font-size:18px;font-weight:700;color:${riskColor}">${r.risk_level}</span><br/><span style="font-size:12px;color:#697586">Risk</span></div>
      <div><span style="font-size:18px;font-weight:700;color:${recColor}">${r.recommendation}</span><br/><span style="font-size:12px;color:#697586">Recommendation</span></div>
    </div>
    <div style="font-size:14px;margin-bottom:8px"><b>Summary:</b> ${r.summary || "—"}</div>
    ${findingsHtml}
  `;
}

async function loadRecent() {
  try {
    const list = await reader.readContract({ address: CONTRACT, functionName: "list_reviews", args: [] });
    const box = $("recent");
    if (!list || !list.length) { box.innerHTML = "<span style='color:#697586'>No reviews yet.</span>"; return; }
    box.innerHTML = list.slice(-5).reverse().map(k => `<div style="padding:6px 0;border-bottom:1px solid #e2e6ec;font-size:13px">${k}</div>`).join("");
  } catch {}
}

window.review = review;
window.loadRecent = loadRecent;
loadRecent();
