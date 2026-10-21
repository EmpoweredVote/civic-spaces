# Contributing to an Empowered Vote repo

**For volunteers and new contributors.** This is the whole process, start to finish: how your
work gets from your laptop into a live EV app.

Good news up front: you do **not** need write access to any EV repository. The process below is
built so that you never need it, and it gives you more freedom to work than write access would.

If you have already run into "I don't have permission to push," nothing has gone wrong and you
haven't missed a step. That is simply where this guide picks up.

Throughout, `<REPO>` is the repository you are working in (`CompassV2`, `civic-spaces`,
`read-rank`, `essentials`, …) and `<YOU>` is your GitHub username. The worked examples use
`CompassV2`; substitute freely.

---

## The short version

1. **Fork** the repo to your own GitHub account.
2. Clone **your fork**, and point an `upstream` remote at the EV original.
3. Make a branch off `upstream/main`.
4. Commit, and push to **your fork**.
5. Open a pull request from your fork into the EV repo.
6. Automated checks run. A maintainer reviews.
7. A maintainer merges. You never merge your own work.

Everything below is detail on those seven steps.

---

## Why you fork instead of getting write access

Pushing a branch directly to the EV repo requires write access, which is reserved for
maintainers. Forking gives you a complete copy of the repository under your own account that
you control absolutely — you can branch, push, force-push, and break things in it freely,
without any permission from anyone.

A pull request from your fork is a *proposal*: "here is my branch, please consider merging it."
The maintainer reviewing it sees exactly the same thing they would see from an internal branch.
Nothing about the review or the merge is second-class. The only difference is who owns the
branch your commits sit on.

This is how the overwhelming majority of open-source contribution works, and it is the path we
have actually used for outside contributors.

---

## One-time setup

You do this once per repository, ever.

### 1. Fork it

Go to `https://github.com/EmpoweredVote/<REPO>` and click **Fork** (top right). Accept the
defaults. You now own `https://github.com/<YOU>/<REPO>`.

### 2. Clone your fork and wire up `upstream`

```bash
git clone https://github.com/<YOU>/<REPO>.git
cd <REPO>
git remote add upstream https://github.com/EmpoweredVote/<REPO>.git
git remote -v
```

That last command should print four lines — `origin` twice (your fork) and `upstream` twice
(the EV repo). This distinction matters for the rest of your life in this repo:

| Remote | Points at | You use it to |
|---|---|---|
| `origin` | **your fork** | push your branches |
| `upstream` | **the EV repo** | pull down everyone else's latest work |

You can never push to `upstream`. You never need to.

### 3. Install and run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Every EV frontend repo ships a `.env.example`. Copy it to `.env.local` (which is git-ignored,
so your values never get committed) and read the comments inside — they say which variables
actually need values and which have working fallbacks.

For **CompassV2** specifically, every variable has a code-level fallback, so `npm run dev` works
with an unmodified copy of `.env.example`. Other repos may need real values; the file will say
so. If something needs a credential you don't have, just ask for it — that is a normal request,
not an imposition. Please don't commit a secret, and if a value is missing, ask rather than
inventing one.

---

## Every change after that

### 1. Start from current `main` — always

```bash
git fetch upstream
git checkout -b feat/compass-onboarding upstream/main
```

Read that second command carefully: it branches off **`upstream/main`**, the EV repo's current
state — *not* off your local `main`, and not off whatever happened to be in your working
directory. Your local `main` goes stale the moment anyone else merges anything, and on these
repos that is often within hours.

This single line prevents the most expensive mistake anyone has made in this codebase. See
**[The stale snapshot](#the-stale-snapshot)** below for what it costs when skipped.

Branch naming: `feat/` for new features, `fix/` for bug fixes, `docs/` for documentation,
`design/` for design and prototype work. Keep it short and descriptive.

### 2. Commit as you go

```bash
git add <the files you changed>
git commit -m "feat(onboarding): add the guided first-run walkthrough"
```

Prefer `git add <specific files>` over `git add -A`. The second one sweeps up stray files you
didn't mean to include — build output, editor settings, screenshots, `.env.local` files with
real credentials in them. Review what you are committing.

Many small commits beat one enormous one. They are easier to review and easier to undo.

### 3. Push to your fork

```bash
git push -u origin feat/compass-onboarding
```

`origin` is your fork. This always works — it is your repository. The `-u` sets the upstream
tracking branch so later pushes are a bare `git push`.

### 4. Open the pull request

The push prints a URL that opens a pre-filled PR. Or:

```bash
gh pr create --repo EmpoweredVote/<REPO> --base main --web
```

Check the top of the PR page before you submit. It should read:

```
EmpoweredVote/<REPO>:main  ←  <YOU>/<REPO>:feat/compass-onboarding
```

Base on the left is the EV repo's `main`. Head on the right is your fork's branch. If the base
says anything other than `EmpoweredVote`, change it.

**Write a description that explains the *why*.** The diff already shows what changed. What a
reviewer cannot get from the diff is what problem you were solving, what you decided against,
what you are unsure about, and what they should look at hardest. Screenshots or a screen
recording are enormously valuable for anything visual, and cost you two minutes.

---

## What happens to your PR

### Checks run automatically

Opening the PR triggers CI. On CompassV2 four checks run — `build`, `lint`, `smoke` and
`test` — and you can watch them at the bottom of the PR page.

🔴 **On your very first pull request, the checks will not start on their own.** GitHub
withholds Actions from first-time contributors until a maintainer clicks **"Approve and run
workflows."** This is a GitHub security default, not a problem with your PR. If your checks
sit at zero, say so in a PR comment and a maintainer will release them. Every subsequent PR
runs automatically.

A note on `smoke` (CompassV2 only): it drives the real app in a headless browser against the
live API, takes about five minutes, and is deliberately the slowest check. It exists because
`build` passing only proves the app compiles — a past bug compiled perfectly and silently
deleted every saved answer. Two of its scenarios need credentials and will **skip** on a fork
PR; that is expected and does not fail the check.

If a check goes red, read its log, push a fix to the same branch, and the PR updates itself.
You don't open a new one.

### A maintainer reviews

Currently **Chris Cantrell (`EmpoweredChris`)** or **Chris Andrews (`chrisandrewsedu`)**.

Expect comments and change requests. This is normal and is not a judgment on your work — it is
how the codebase stays coherent across many contributors. Push fixes to the same branch and they
appear on the PR automatically.

If you think a review comment is wrong, say so and explain why. Reviewers are not always right,
and a contributor who pushes back with reasoning is more useful than one who silently complies.

### A maintainer merges

**Never merge your own pull request**, even if GitHub's button is green and clickable. On some
repos it will be — the required-approval count is zero and nothing mechanically stops you. The
review is the point, not the button.

---

## What each repo requires

Branch protection differs per repository. Verified 2026-10-01:

| Repo | Required checks | Approvals required |
|---|---|---|
| `CompassV2` | `build`, `smoke` | 0 |
| `civic-spaces` | `build` | **1** |
| `read-rank` | `build` | 0 |
| `essentials` | `build` | 0 |
| `treasury-tracker` | `build` | 0 |
| `ev-ui` | — | 0 |

"0 approvals required" is a statement about the automation, not about the process. A maintainer
still reads your PR before it merges. On `civic-spaces` that review is additionally enforced in
software.

`civic-spaces` has one special case: a PR whose files are *all* documentation (`.planning/**`
or `*.md`) is approved automatically. One non-doc file and it becomes a normal review.

---

## The mistakes that have actually cost us

These are not hypotheticals. Each one has happened here.

### The stale snapshot

A contributor worked locally for three weeks, then committed their whole working directory onto
current `main` in one go. Git reported no conflicts, and the branch was zero commits behind, so
everything looked clean.

It wasn't. The snapshot was three weeks old, so it carried old versions of files that `main` had
*modified* in the meantime — silently reverting a month of other people's fixes with no conflict
markers to warn anyone. Among the things it quietly undid: an authentication fix for a
production outage, a guard against request storms, and a build script correction that had been
masking 25 type errors.

Unwinding it took **sixteen pull requests** reviewed one at a time.

**The fix is one line:** `git checkout -b <branch> upstream/main` after a `git fetch upstream`.
Branch from current `main` every single time. If you have been working a long time, rebase onto
`upstream/main` and deal with conflicts *as conflicts*, where you can see them — never by
overwriting files wholesale.

### `git add -A` on a dirty directory

Sweeps in build output, editor config, local screenshots, and `.env.local` files containing real
credentials. Add files deliberately. Run `git status` before every commit.

### Assuming local `main` is current

It is routinely tens of commits behind. `git fetch upstream` costs a second. Do it before you
branch, every time.

---

## Keeping your fork up to date

Your fork does not update itself. Before starting anything new:

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
```

`--ff-only` is deliberate: it refuses rather than creating a confusing merge commit. If it
fails, your local `main` has commits on it that shouldn't be there — ask rather than forcing it.

You can also skip this entirely. Branching straight off `upstream/main` works whether or not
your fork's `main` is current, which is why step 1 above is written the way it is.

### Updating a branch that has gone stale mid-review

```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease
```

`--force-with-lease` instead of `--force`: it refuses if someone else has pushed to your branch
in the meantime. On your own fork this is nearly always safe.

---

## Before you open the PR — a checklist

- [ ] Branched from `upstream/main`, not local `main`, not a snapshot
- [ ] `npm run build` passes locally
- [ ] `npm run lint` passes, if the repo has it
- [ ] `npm test` passes, if the repo has it
- [ ] No `.env.local`, credentials, build output, or stray screenshots in the diff
- [ ] `git status` is clean apart from what you meant to change
- [ ] The PR base is `EmpoweredVote/<REPO>:main`
- [ ] The description explains *why*, and includes screenshots for anything visual

---

## When you are stuck

Ask early, and ask as often as you like — questions are genuinely welcome here, and no one will
think less of you for asking one. A question costs five minutes. An assumption carried quietly
for three weeks can cost a great deal more, and that is nobody's idea of a good trade.

- **Something in the codebase makes no sense** — check the repo's `CLAUDE.md` and `.planning/`
  directory first. They usually record *why* something is the way it is, which is the part that
  is expensive to re-derive.
- **You need a credential, an API key, or access to something** — ask. Never commit a secret,
  and never work around a missing one by inventing a value.
- **Your checks won't start** — that is the first-contribution approval gate. Comment on the PR.
- **You are about to do something drastic** (force-push, revert a merge, delete a branch
  others might be on) — ask first. These are the operations that are hard to undo.

---

## If you are working with Claude

Several of us use Claude to work in these repos, and most EV repositories contain a `CLAUDE.md`
at the root. Point Claude at it before anything else — it records the conventions, constraints
and landmines that are not obvious from reading the code, and it is kept current deliberately.

Two things worth telling it explicitly, because they are the ones that go wrong:

- You are working **on a fork**. `origin` is yours; `upstream` is the EV repo; branches come off
  `upstream/main`.
- It should **not** merge, cherry-pick, or carry forward work from an older branch or snapshot
  without flagging it to you first. That is the stale-snapshot failure above, and it is the one
  an agent is most likely to reproduce because it looks clean to git.
