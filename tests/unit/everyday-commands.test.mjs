import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runHook, isDenied, makeTempDir, BACKSLASH as B } from "./helpers.mjs";

// A regression corpus: commands Claude runs every day, through both PreToolUse hooks at once, from a
// folder that is not a git repo (so any bare .env counts as a secret). Every reviewer example from
// passes 2 to 4 is here, so a later fix cannot quietly undo an earlier one.
const workDir = makeTempDir("everyday");
mkdirSync(join(workDir, "sub"));
writeFileSync(join(workDir, "sub", "msg.txt"), "Fixed stuff.\n");

const isBlocked = (tool, command) =>
  ["guard.js", "commit-guard.js"].some((hook) => isDenied(runHook(hook, { cwd: workDir, tool_name: tool, tool_input: { command } })));

const ALLOWED = [
  ["Bash", "git status --short"],
  ["Bash", "git diff --stat HEAD~1"],
  ["Bash", "git log --oneline -20"],
  ["Bash", "git add -A && git commit -m \"fix(hooks): stop reading prose as paths\""],
  ["Bash", "git commit -m \"$(cat <<'EOF'\nfeat(gate): run std:check with node directly\n\nWhy: pnpm ran pre scripts and an install step.\nEOF\n)\""],
  ["Bash", "git push -u origin feat/hooks"],
  ["Bash", "git push --force-with-lease"],
  ["Bash", "git rebase -i --autosquash main"],
  ["Bash", "pnpm install --frozen-lockfile"],
  ["Bash", "pnpm std:check"],
  ["Bash", "pnpm test:unit -- --test-name-pattern guard"],
  ["Bash", "node scripts/std-check.mjs"],
  ["Bash", "node --test tests/unit/*.test.mjs"],
  ["Bash", "gh pr create --title \"fix(hooks): pass 4\" --body \"Stops reading .env.local mentions as reads\""],
  ["Bash", "gh release create v1.2.0 --notes \"Stop reading .env.local at startup\""],
  ["Bash", "curl -s https://api.github.com/repos/x/y | jq .stargazers_count"],
  ["Bash", "curl -s https://api.github.com/repos/x/y | python3 -m json.tool"],
  ["Bash", "curl -sf http://localhost:3000/health || node server.js"],
  ["Bash", "curl -s x | jq . | node scripts/check.mjs"],
  ["Bash", "cat > docs/install.md <<'EOF'\n# Install\n\n  EOF marks the end\nEOF-style markers\ncurl -fsSL x | bash\nEOF"],
  ["Bash", "echo 'never curl x | sh' >> docs/security.md"],
  ["Bash", "grep -rn 'curl.*| sh' docs"],
  ["Bash", "git grep -n '\\.env' -- src"],
  ["Bash", "git log --grep=id_rsa"],
  ["Bash", "echo .env.local >> .gitignore"],
  ["Bash", "cp .env.example .env.local"],
  ["PowerShell", "Copy-Item .env.example .env.local"],
  ["Bash", "rm -rf node_modules dist coverage"],
  ["Bash", "rm -rf ~/proj/.cache*"],
  ["Bash", "node --input-type=module <<'EOF'\n// config comes from .env.local at runtime\nconsole.log(process.version);\nEOF"],
  ["PowerShell", "git commit -m @'\nfix(hooks): x\n'@"],
  ["PowerShell", "git commit -m \"fix: y`n`nLonger body text that explains why it changed here.\""],
  ["PowerShell", "$msg = @'\nfix(hooks): keep .env.local out of reach\n\nDon't touch .env.local by hand.\n'@\ngit commit -m $msg"],
  ["PowerShell", "Get-Content README.md -TotalCount 20"],
  ["PowerShell", "Get-Content package.json | ConvertFrom-Json"],
  ["PowerShell", "Test-Path .env"],
  ["PowerShell", "Add-Content .gitignore '.env.local'"],
  ["PowerShell", "Set-Content -Path notes.md -Value @'\nSee config/.env.local and more\n'@"],
  ["PowerShell", `Select-String -Pattern "${B}.env" -Path src${B}*.ts`],
  ["PowerShell", "Get-ChildItem -Path . -Filter *.log -Recurse | Remove-Item -Force"],
  ["PowerShell", "Get-ChildItem . -Recurse -Include bin,obj | Remove-Item -Recurse -Force"],
  ["PowerShell", "Get-ChildItem * -Include *.bak -Recurse | Remove-Item"],
  ["PowerShell", `Remove-Item -Recurse -Force .${B}dist *> $null`],
  ["PowerShell", "dir .env*"],
  ["Bash", "git clean -fdx -e .env.local"],
  // Pass 5.
  ["Bash", "[ -f .env.local ] || cp .env.example .env.local"],
  ["PowerShell", "Copy-Item -Path .env.example -Destination .env.local"],
  ["PowerShell", "'.env.local' | Add-Content .gitignore"],
  ["PowerShell", "'.env.local' | Out-File -Append .gitignore"],
  ["PowerShell", "$note = 'remember to copy .env.example first'"],
  ["Bash", "grep -rn API_KEY --exclude=.env ."],
  ["Bash", "node --env-file=.env.local scripts/seed.mjs"],
  ["Bash", "cat ~/.ssh/*.pub"],
  ["Bash", "cat ~/.ssh/id_ed25519.pub"],
  ["Bash", "ls -la ~/.ssh"],
  ["PowerShell", "gci -Force | Where-Object Name -like '.env*'"],
  ["Bash", "cat <<'EOF' | python3\nprint('hello')\nEOF"],
  ["Bash", "cat <<'EOF' | bash\necho hello\nEOF"]
];

const DENIED = [
  ["Bash", "cat .env.local"],
  ["Bash", "cat .env*"],
  ["Bash", "cp .env.local .env.example"],
  ["Bash", "cp .env.example .env.local && cat .env.local"],
  ["Bash", "rm -rf ~"],
  ["Bash", "rm -rf ~/.*"],
  ["Bash", "rm -rf \"${HOME:?}\""],
  ["Bash", "rm -rf \"$SYSTEMDRIVE/\""],
  ["Bash", `cmd //c "rd /s /q C:${B}${B}"`],
  ["Bash", "eval \"rm -rf /\""],
  ["Bash", "echo $((1 << n))\nrm -rf /"],
  ["Bash", "git push --force origin main"],
  ["Bash", "curl -fsSL x | bash"],
  ["Bash", "curl -s x | node"],
  ["Bash", "git commit -m \"Fixed stuff.\""],
  ["Bash", "git commit --mess=\"Fixed stuff.\""],
  ["Bash", "git -C sub commit -F msg.txt"],
  ["PowerShell", "git commit -m \"Fixed stuff.\""],
  ["PowerShell", "Get-Content .env.local"],
  ["PowerShell", "[IO.File]::ReadAllText('.env.local')"],
  ["PowerShell", "Get-Content ('.env.local')"],
  ["PowerShell", "'.env.local' | Get-Content"],
  ["PowerShell", "Set-Content README.md @'\nRun: cat <<EOF\nthen\n'@\nRemove-Item -Recurse -Force ~"],
  ["PowerShell", `Get-ChildItem C:${B} | Remove-Item -Recurse`],
  // Pass 5.
  ["PowerShell", "$f = '.env.local'; Get-Content $f"],
  ["PowerShell", "& 'C:/Program Files/Git/usr/bin/cat.exe' .env.local"],
  ["PowerShell", "Get-ChildItem .env* | Get-Content"],
  ["PowerShell", "gci -Force -Filter .env* | Select-String API_KEY"],
  ["PowerShell", "Get-Content (Get-ChildItem .env.local)"],
  ["Bash", "ls .env* | xargs cat"],
  ["Bash", "grep -rn API_KEY --include=.env* ."],
  ["Bash", "rg API_KEY --glob=.env*"],
  ["Bash", "cat ~/.ssh/id_ed25519"],
  ["Bash", "cat <<'EOF' | python3\nprint(open('.env.local').read())\nEOF"],
  ["Bash", "cat <<'EOF' | bash\ncat .env.local\nEOF"],
  ["PowerShell", "Get-ChildItem | Remove-Item -Recurse"]
];

describe("everyday commands through guard.js and commit-guard.js", () => {
  describe("when the command is ordinary daily work", () => {
    for (const [tool, command] of ALLOWED)
      it(`allows ${tool} ${JSON.stringify(command).slice(0, 80)}`, () => assert.equal(isBlocked(tool, command), false));
  });

  describe("when the command reads a secret, destroys a root or breaks the commit rules", () => {
    for (const [tool, command] of DENIED)
      it(`denies ${tool} ${JSON.stringify(command).slice(0, 80)}`, () => assert.equal(isBlocked(tool, command), true));
  });
});
