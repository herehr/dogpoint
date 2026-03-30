# Rebrand grep checklist (template fork)

Run from repo root when cloning for a new client. Replace findings with **env-driven** or **client config** values.

```bash
# Brand / product
rg -n "Dogpoint|dogpoint|DOGPOINT|dog-point" --glob '!**/node_modules/**' --glob '!**/dist/**'

# Czech locale marker
rg -n 'lang="cs"|lang=cs' frontend backend

# Storage / product-specific keys
rg -n "dogpoint\.access" frontend

# Email layout (addresses, entity)
rg -n "Milánská|Malotice|info@dog-point|607 018" backend frontend

# Hardcoded production domain / CDN
rg -n "patron\.dog-point|ondigitalocean" backend frontend

# Analytics (replace per client)
rg -n "googletagmanager|gtag|G-[A-Z0-9]+" frontend

# CSV / download filenames
rg -n "dogpoint-adopce" frontend

# FIO / Czech bank specifics (optional for DE)
rg -n "595\\\\d|FIO|variable symbol|VS" backend frontend
```

After rebrand, add your client strings to a single config module so the next clone only touches **env + logo + legal URLs**.
