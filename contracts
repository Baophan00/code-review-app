# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *


class CodeReviewOracle(gl.Contract):
    """Intelligent Contract that reviews a GitHub pull request using AI
    consensus.  Fetches the PR page, LLM analyses for bugs/security/style,
    and validators must agree on score + findings before committing."""

    reviews: TreeMap[str, str]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def review_pr(self, pr_url: str, focus: str = "all") -> str:
        """Review a GitHub PR by fetching its page.

        Args:
            pr_url:  URL to the PR.
            focus:   "all" | "security" | "bugs" | "style"

        Returns:
            JSON with score, findings, summary, recommendation.
        """
        if not pr_url:
            raise gl.vm.UserError("pr_url is required")
        if focus not in ("all", "security", "bugs", "style"):
            raise gl.vm.UserError("focus must be all/security/bugs/style")

        def ask() -> str:
            # Runs once for the leader and once per validator.
            try:
                page = gl.nondet.web.render(pr_url, mode="text")[:12000]
            except Exception:
                page = "(could not read the PR page)"

            prompt = f"""You are an expert code reviewer.  Review the following GitHub
pull request page for code quality issues.

PR URL: {pr_url}
Focus area: {focus}

Page content (may include diff):
```
{page}
```

Analyse for:
- Bugs / logic errors
- Security vulnerabilities
- Performance issues
- Style / readability problems
- Missing tests or edge cases

Return ONLY a valid JSON object:
{{
  "pr_url": "{pr_url}",
  "focus": "{focus}",
  "score": <integer 1-10, where 10 is excellent>,
  "risk_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "findings": [
    {{
      "id": "F-001",
      "category": "<bug|security|performance|style|test>",
      "severity": "<LOW|MEDIUM|HIGH|CRITICAL>",
      "description": "<brief>",
      "suggestion": "<fix>"
    }}
  ],
  "summary": "<2-3 sentence overall assessment>",
  "recommendation": "<APPROVE|REQUEST_CHANGES|COMMENT>"
}}"""

            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                raise gl.vm.UserError("model did not return a review")
            return json.dumps(
                {
                    "pr_url": str(raw.get("pr_url", pr_url)),
                    "focus": str(raw.get("focus", focus)),
                    "score": int(raw.get("score", 5)),
                    "risk_level": str(raw.get("risk_level", "MEDIUM")).upper().strip(),
                    "findings": raw.get("findings", []),
                    "summary": str(raw.get("summary", "")).strip()[:500],
                    "recommendation": str(raw.get("recommendation", "COMMENT")).upper().strip(),
                },
                sort_keys=True,
            )

        principle = (
            "The two answers review the same pull request. They agree when "
            "they choose the same recommendation (APPROVE, REQUEST_CHANGES or "
            "COMMENT) and the score is within 2 points. The findings may be "
            "worded differently. A different recommendation on the same code is "
            "a disagreement."
        )
        agreed = gl.eq_principle.prompt_comparative(ask, principle=principle)
        result = json.loads(agreed)
        if str(result.get("recommendation", "")) not in ("APPROVE", "REQUEST_CHANGES", "COMMENT"):
            raise gl.vm.UserError("no usable review was reached")

        key = pr_url.split("/")[-1] if "/" in pr_url else pr_url[:40]
        self.reviews[key] = json.dumps(result, sort_keys=True)
        return json.dumps(result, sort_keys=True)

    @gl.public.view
    def get_review(self, pr_url: str) -> str:
        key = pr_url.split("/")[-1] if "/" in pr_url else pr_url[:40]
        return self.reviews.get(key, "{}")

    @gl.public.view
    def list_reviews(self) -> list[str]:
        return list(self.reviews.keys())

    @gl.public.view
    def contract_info(self) -> dict:
        return {
            "name": "CodeReviewOracle",
            "version": "1.0.0",
            "description": "Decentralized AI code review for GitHub pull requests",
            "author": "modaz",
        }
