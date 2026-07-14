# Personal Financial Planning Scenario Planner

An educational, single-page web app that lets you explore a **simplified** personal
financial plan: how your savings might grow before retirement, whether the plan looks
roughly on track, and how things change under Conservative, Moderate, and Optimistic
assumptions.

> ⚠️ **Important:** This is an educational demonstration built for a workshop about
> AI-assisted coding. It is **not** financial, tax, investment, or legal advice.
> All calculations happen in your browser — nothing you type is saved or sent anywhere.

---

## What the app does

- You enter basic details: age, retirement age, income, savings, monthly contributions,
  expenses, planned retirement spending, and an optional one-time major expense
  (education, home purchase, travel, etc.).
- You pick a scenario — **Conservative**, **Moderate**, or **Optimistic** — each with
  its own investment return, income growth, and inflation assumptions. You can also
  fine-tune those assumptions yourself.
- The app instantly shows:
  - Estimated savings at retirement
  - Savings right after the major expense
  - First-year retirement spending (inflation-adjusted)
  - Whether the plan appears on track, and the gap or surplus
  - A year-by-year projection chart out to age 95
  - A side-by-side comparison of all three scenarios
- Buttons let you **reset**, **load a worked example**, and **print / save as PDF**.

## Project files

```
financial-scenario-planner/
├── index.html        ← the page itself (structure and text)
├── css/
│   └── styles.css    ← all visual styling (colors, layout, print styles)
├── js/
│   └── app.js        ← the calculations, chart drawing, and interactivity
├── README.md         ← this file
├── LICENSE           ← MIT open-source license
└── .gitignore        ← tells Git which files to ignore
```

No build tools, frameworks, servers, accounts, or API keys are needed. It is plain
HTML, CSS, and JavaScript.

## How to preview it locally

1. Download or copy the `financial-scenario-planner` folder to your computer.
2. Double-click `index.html`. It opens in your web browser and works immediately —
   no internet connection required.

## How to publish it free with GitHub Pages

GitHub Pages is a free service that turns a folder of files into a public website.

### Step 1 — Create a GitHub account and repository

1. Go to <https://github.com> and sign up (free) if you don't have an account.
2. Click the **+** in the top-right corner → **New repository**.
3. Name it something like `financial-scenario-planner`.
4. Keep it **Public**, and do **not** tick any of the "initialize" checkboxes.
5. Click **Create repository**.

### Step 2 — Upload the files

**Easiest way (no tools needed):**

1. On your new empty repository page, click the link that says
   **"uploading an existing file"**.
2. Drag **all** the files and folders from `financial-scenario-planner` into the
   upload area (`index.html`, the `css` and `js` folders, `README.md`, `LICENSE`,
   `.gitignore`).
3. Click **Commit changes**.

**Or, if you use Git on the command line:**

```bash
cd financial-scenario-planner
git init
git add .
git commit -m "Initial version of the scenario planner"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/financial-scenario-planner.git
git push -u origin main
```

### Step 3 — Turn on GitHub Pages

1. In your repository, click **Settings** (top menu) → **Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose `main` and folder `/ (root)`, then click **Save**.
4. Wait a minute or two, then refresh the page.

### Step 4 — Find your public URL

The Pages settings page will show a green box with your live address:

```
https://YOUR-USERNAME.github.io/financial-scenario-planner/
```

Share that link with anyone — the site is now public.

## How to make future changes with an AI coding agent

1. Open the project folder in your AI coding tool (for example Claude Code or Codex).
2. Describe the change in plain English, e.g.
   *"Add a field for expected Social Security income and include it in the retirement math."*
3. Review what changed, then re-upload the edited files to GitHub (or `git push`).
4. GitHub Pages updates the live site automatically within a minute or two.

## Calculation assumptions & limitations

The math is deliberately simple so it can be explained in one paragraph:

- Savings grow by a **smooth average annual return** — real markets go up and down.
- Yearly contributions (monthly amount × 12) grow at the income growth rate and
  **stop at retirement**.
- The major expense is entered in today's dollars and **inflated** to the year it occurs.
- Retirement spending is entered in today's dollars, inflated to the retirement year,
  and then rises with inflation each year; the projection runs to **age 95**.
- "On track" uses the classic **4% rule** of thumb: a nest egg of about
  **25× first-year retirement spending**.
- **Not modeled:** taxes, investment fees, Social Security or pensions, market
  volatility, changing contribution habits, healthcare shocks, or currency effects.

## License

Released under the [MIT License](LICENSE) — free to use, copy, modify, and share.
