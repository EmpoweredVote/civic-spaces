# Throwaway — proving the auto-approval dismissal arm

Temporary. This PR is opened to exercise one untested path in
`.github/workflows/docs-auto-approve.yml`: that a docs-only PR which later gains a
non-doc file has its automatic approval **withdrawn**.

Sequence:

1. This file alone — docs-only, so the workflow should approve.
2. A non-doc file is then pushed to the same branch.
3. The workflow should re-run, classify the PR as not-docs-only, and dismiss its own
   earlier approval.

Closed without merging once observed.
