TASKS — MAIN RUNNER

Read this every round, after RUNNER-SCOPE.md and the priorities block.

Work top to bottom. If a task is blocked, skip it, say why, move on.

---

Today (before anything else)

1. Save VOICE.md.
Put docs/strategy/VOICE.md on the box. Add one line to the top of the runner prompt: "Read VOICE.md before any user-facing text ships."

2. Save the support page.
Put docs/strategy/SUPPORT-PAGE.md on the box. It is the crowdfunding spec. Do not build it yet. Just save it.

3. Check the SSH deploy key.
Run: test -f ~/.ssh/vvu_deploy_main && echo "EXISTS" || echo "MISSING"
If missing — generate it. Print the public key. Tell the operator to add it to GitHub. Stop the round.

---

This week

4. Clean main.
Write .gitignore. Untrack the runtime churn. Commit the filter.

5. Verify the card works.
Open card.html in a browser.
Check the four views: CARD, CAPTURE, QUEUE, SIGNATURE.
Save a test contact. Reload. It should still be there.

6. Check the sync endpoint.
Run: curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/vvu/captures/sync
If it returns 404 — build the route. If it returns 200 — check the fail-closed rules.

7. Send the four academic letters.
Use the version in the current worklog. Plain voice. No jargon.
Each letter points to the published research.

---

Next week

9. Publish the evidence-chain methodology.
How an alert becomes a receipt. Step by step. Plumber-readable.

10. Write cluster 1.
Four articles on water monitoring. Cross-linked. Plain voice.

11. Start municipal outreach.
30 named leads. Each email points at one specific article.

---

The week after

12. Write cluster 2.
Four articles on POPIA compliance. Same shape.

13. Write cluster 3.
Four articles on audit survival. Same shape.

14. Record the 2-minute video.
Use the script in the marketing doc. Plain voice.

15. Send newsletter #1.
To whoever signed up. Short. One action.

---

When the first pilot closes

16. Document it.
Write the case study. Plain voice. Real numbers only.

17. Wire the pilot captures.
The card should sync pilot data to main. Verify it works.

18. Extend the manifest.
Add the new artifacts. Sign. Verify. Push.

---

Rules that apply to every task

```
· Plain voice. Plumber test. Every word.
· One action per ending. Not a menu.
· No jargon. No regulatory language.
· Fail-closed. If it breaks, stop. Do not fake it.
· One commit per task. Descriptive message.
· Worklog entry after every task.
```

---

What to do when a task is blocked

Say so in the worklog. Name what is missing.

Do not:

· Invent a workaround
· Skip the worklog entry
· Claim BUILT for something that isn't

Then move to the next task.

---

The one-line summary

Save the files. Clean main. Ship the card. Send the letters. Publish the research. Get the pilot.

That's the whole job.
