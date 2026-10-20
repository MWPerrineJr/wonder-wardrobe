<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->
- Fake-review scoring runs in the `score_feedback_fraud` insert trigger on customer_feedback; quarantined rows are excluded from feedback KPIs. Why: every feedback source is checked the same way, server-side.
- Client recall uses owner-sent mailto/sms links, not app emails. Why: re-engagement mail is marketing and is not allowed on the app email channel.
