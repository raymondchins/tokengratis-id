# tokengratis.id — Changelog

> **APPEND-ONLY.** Use bash `>>` heredoc to add entries. NEVER edit existing entries (git is revision history).
>
> **Format:** `### YYYY-MM-DD — Title (commit \`SHA\`)`. Append directly to this file — no sandbox copy needed (Code tab desktop writes to local NTFS).

---

## How to append

```bash
cat >> docs/CHANGELOG.md <<'ENTRY'

### YYYY-MM-DD — Short title (commit `abc1234`)

**Trigger / context:** ...

**Changes:**
- ...

**Test cases (after deploy):**
1. ...

ENTRY

# Verify:
tail -10 docs/CHANGELOG.md
```

---

<!-- First entry below this line. DO NOT delete this comment block — keeps the format reference at top. -->
