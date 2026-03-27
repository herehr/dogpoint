# Často kladené otázky (FAQ) – Dogpoint

Krátký průvodce adopcí na dálku pro dárce. Text odpovídá hlavním krokům v aplikaci (veřejné části).

---

## Obsah (kliknutím na odkaz skočíte na sekci)

| Oblast | Odkaz |
|--------|--------|
| Úvod | [Co je adopce na dálku](#co-je-adopce-na-dálku) |
| Výběr zvířete | [Jak najdu zvíře](#jak-najdu-zvíře-a-spustím-adopci) |
| Platba | [Platba kartou a online](#platba-kartou-prípadně-apple-pay--google-pay) · [Bankovní převod](#bankovní-převod) |
| Účet | [Registrace a přihlášení](#registrace-a-přihlášení) · [Zapomenuté heslo](#zapomenuté-nebo-první-heslo) |
| Po zaplacení | [Moje adopce](#moje-adopce) · [Zrušení adopce](#zrušení-adopce) |
| Sdílení | [Sdílení se známým](#sdílení-se-známým-pozvánka) |
| Daně | [Daňové potvrzení – údaje](#daňové-potvrzení--údaje-pro-potvrzení) |
| Ostatní | [Notifikace](#notifikace) · [Soukromí](#ochrana-osobních-údajů) · [Nefunguje platba nebo e-mail](#nefunguje-platba-nebo-nedorazil-e-mail) |

**Tip pro vyhledávání:** Nad textem je pole **Hledat** – zúží zobrazení na sekce, kde se slova vyskytují (hledání ignoruje háčky a čárky; více slov musí být všechna v jedné sekci). Doplňkově můžete v prohlížeči použít `Ctrl+F` / `Cmd+F` (např. *Stripe*, *VS*, *pozvánka*).

---

## Co je adopce na dálku?

**Hledané výrazy:** podpora zvířete, měsíční příspěvek, útulek

Adopce na dálku znamená **pravidelnou finanční podporu** konkrétního zvířete v útulku. Peníze jdou na péči, krmivo a provoz. V aplikaci uvidíte **aktualizace** (fotky, videa, příspěvky od moderátorů), pokud k adopci přispíváte podle pravidel portálu.

Na úvodní stránce je sekce **„Jak funguje adopce na dálku?“** – stručně vysvětluje smysl adopce, online sledování a výběr měsíčního příspěvku (např. od 100 Kč výše podle nabídky).

---

## Jak najdu zvíře a spustím adopci?

**Hledané výrazy:** seznam zvířat, detail, adopce, částka

1. V menu přejděte na **Zvířata** (`/zvirata`) – zobrazí se dostupná zvířata.
2. Otevřete **detail zvířete** (klik na kartu nebo přímý odkaz `/zvire/:id`).
3. Spusťte adopci přes tlačítko pro platbu / přechod na platební krok (podle stavu přihlášení a rozhraní na detailu).

Platební stránka adopce je typicky na adrese **`/adopce/:id`** – u zvířete můžete mít předvyplněnou **částku** v odkazu, např. `?amount=200` (výchozí bývá např. 200 Kč, pokud není uvedeno jinak).

---

## Platba kartou (případně Apple Pay / Google Pay)

**Hledané výrazy:** Stripe, karta, online platba, checkout

- Vyberte způsob platby kartou (nebo podporované digitální peněženky, pokud je nabízí prohlížeč).
- Vyplňte **e-mail** a v potřebných krocích **jméno a heslo** (založení nebo přihlášení účtu souvisí s dokončením adopce).
- Po úspěšné platbě vás aplikace navede zpět – často na **detail zvířete** nebo do **Moje adopce**.

Po návratu ze Stripe může být v URL parametr `paid=1` – aplikace tím dokončí propojení platby s účtem.

---

## Bankovní převod

**Hledané výrazy:** Fio, VS, variabilní symbol, QR, SPAYD, IBAN, převod

Bankovní platba se na webu zobrazí jen pokud je pro dané prostředí **zapnutá** (konfigurace serveru a frontendu). Obvykle:

1. Zvolíte bankovní převod na stránce adopce.
2. Zadáte údaje pro vytvoření předplatného v systému – včetně **e-mailu** a **hesla** (min. délka podle validace).
3. Zobrazí se **údaje k platbě**: číslo účtu (IBAN), **variabilní symbol (VS)**, částka; často i **QR kód** ve formátu **SPAYD** pro mobilní bankovnictví.
4. Po odeslání převodu můžete použít tlačítka typu **„Zaplatil jsem“** nebo **„Pošlete mi údaje e-mailem“** – podle toho, co rozhraní nabízí.
5. Spárování plateb z účtu probíhá **automatickým importem** (např. z Fio) – není potřeba posílat potvrzení ručně, ale první platba musí sedět s VS a částkou.

Pokud bankovní volbu **nevidíte**, portál může mít bankovní kanál vypnutý – použijte platbu kartou, nebo kontaktujte provozovatele.

---

## Registrace a přihlášení

**Hledané výrazy:** účet, login, e-mail, heslo

- **Přihlášení** je v menu (`/login`). Použijete e-mail a heslo z registrace.
- Účet se často zakládá **v rámci adopce** (z platebního kroku) – stejný e-mail pak slouží k přihlášení.
- Role **běžného uživatele** (dárce) je po přihlášení vedena na **Moje adopce** (`/user`) nebo na rozhraní podle nastavení menu.

---

## Zapomenuté nebo první heslo

**Hledané výrazy:** obnova hesla, odkaz, token

- Na přihlašovací stránce použijte **obnovu hesla** (zadejte e-mail účtu).
- Přijde e-mail s odkazem na **`/obnovit-heslo?token=...`** – odkaz má **omezenou platnost** (typicky 1 hodina).
- Po nastavení nového hesla se přihlaste stejným e-mailem.

Pokud odkaz vede na **jinou doménu**, než na které jste žádost odeslali (např. produkce vs. testovací prostředí), obnova nemusí fungovat – používejte stejnou adresu portálu, na které účet používáte.

---

## Moje adopce

**Hledané výrazy:** /user, předplatné, stav ACTIVE, zvíře

Po přihlášení najdete přehled v **Moje adopce** (`/user`):

- Karty **adoptovaných zvířat** s datem od kdy adopce běží a stavem (např. **ACTIVE**).
- Odkaz **Zobrazit detail** vede na stránku zvířete.
- U aktivní adopce můžete **sdílet přístup** (viz níže) – ikona osoby s plusem.

U pozvánky jako příjemce se může zobrazit informace, **od koho** pozvánka přišla.

---

## Zrušení adopce

**Hledané výrazy:** zrušit, předplatné, konec adopce

Na **detailu zvířete** (jste-li přihlášen jako platící dárce, ne jako pouze pozvaný divák) bývá akce **„Zrušit adopci“**. Po zrušení podle pravidel portálu:

- předplatné se ukončí;
- **pozvaní diváci** (sdílení) mohou ztratit přístup a mohou dostat informační e-mail.

Přesné chování závisí na backendu a typu platby; hlavní akce je vždy na straně **platícího předplatitele**.

---

## Sdílení se známým (pozvánka)

**Hledané výrazy:** pozvánka, e-mail, neplatící, max 5, platnost

Platící dárce může pozvat někoho, aby **viděl aktualizace zvířete** bez vlastní platby:

1. Na **detailu zvířete** nebo v **Moje adopce** otevřete **Sdílet se známým**.
2. Zadejte **e-mail příjemce**, volitelně krátkou zprávu a důvod ze seznamu.
3. Příjemce dostane **e-mail s odkazem** na stránku pozvánky (`/invite/:token`).
4. Po přihlášení / registraci se stejným e-mailem se sdílení aktivuje.

**Pravidla z backendu:**

- Na jednu adopci platí nejvýše **5 aktivních sdílených přístupů** (přijatých pozvánek / záznamů o přístupu).
- Na stejný e-mail nelze mít současně **dvě čekající pozvánky** – musí vypršet, nebo ji příjemce vyřídí.
- Pozvánka má **omezenou platnost** (výchozí např. **7 dní**; na serveru lze nastavit `SHARE_INVITE_EXPIRY_DAYS`, max. 30).
- Zpráva v pozvánce: max. **300 znaků**.

---

## Daňové potvrzení – údaje pro potvrzení

**Hledané výrazy:** token, IČO, adresa, firma, fyzická osoba

Pokud máte od portálu e-mail s žádostí o údaje pro daňové potvrzení, otevřete odkaz vedoucí na **`/udaje-pro-potvrzeni?token=...`**. Vyplňte formulář (osoba / firma, adresa, DIČ podle potřeby) a odešlete. Platnost odkazu je v e-mailu vymezena – po vypršení je třeba vyžádat nový odkaz u podpory.

---

## Notifikace

**Hledané výrazy:** zvoneček, upozornění, nový příspěvek

V záhlaví je odkaz na **Notifikace** (`/notifikace`) – přehled systémových zpráv pro váš účet (např. novinky k adopci). Ikona může signalizovat nepřečtené položky.

---

## Ochrana osobních údajů

**Hledané výrazy:** GDPR, zásady, soukromí

Veřejná stránka **`/ochrana-osobnich-udaju`** popisuje zpracování osobních údajů v souladu s provozem portálu.

---

## Nefunguje platba nebo nedorazil e-mail?

**Hledané výrazy:** chyba, SMTP, test, spam

| Problém | Co zkusit |
|--------|------------|
| Platba kartou se nedokončí | Zkontrolujte blokování vyskakovacích oken, zkuste jiný prohlížeč nebo kartu. |
| Po platbě nevidíte adopci | Přihlaste se stejným e-mailem jako u platby; počkejte chvíli a obnovte **Moje adopce**. |
| E-mail nedorazil (obnova hesla, pozvánka) | Zkontrolujte **spam**; ověřte, že používáte **správnou doménu** portálu (stejné prostředí jako při žádosti). |
| Provozovatel testuje backend | Endpoint **`GET /health/email`** (na API) ukáže, zda je nakonfigurované odesílání e-mailů (SMTP). Testovací odeslání: **`GET /api/email/test?to=váš@email.cz`** (podle nasazení). |

Technické detaily SMTP a proměnné prostředí jsou v **`backend/.env.example`** a v dokumentaci nasazení (`DEPLOY.md`).

---

## Klíčové adresy (stručně)

| Cesta | Účel |
|-------|------|
| `/` | Úvod |
| `/caste-dotazy` | Časté dotazy (tato stránka) |
| `/zvirata` | Seznam zvířat |
| `/zvire/:id` | Detail zvířete |
| `/adopce/:id` | Zahájení adopce / platba (volitelně `?amount=`) |
| `/login` | Přihlášení |
| `/user` | Moje adopce |
| `/obnovit-heslo` | Nastavení nového hesla z e-mailu |
| `/invite/:token` | Přijetí pozvánky ke sdílení |
| `/notifikace` | Notifikace |
| `/udaje-pro-potvrzeni` | Daňové údaje z odkazu v e-mailu |
| `/ochrana-osobnich-udaju` | Ochrana osobních údajů |

---

*Poslední aktualizace textu: podle struktury frontendu (`App.tsx`) a backendových pravidel pro sdílení (`shareInviteService`). Při změně funkcí upravte odpovídající sekce.*
