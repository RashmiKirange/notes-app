import os
import subprocess
from groq import Groq
from github import Github

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
ISSUE_NUMBER = int(os.environ["ISSUE_NUMBER"])
ISSUE_TITLE = os.environ["ISSUE_TITLE"]
ISSUE_BODY = os.environ.get("ISSUE_BODY", "")
REPO_NAME = os.environ["REPO_NAME"]

CODEBASE_FILES = [
    "backend/main.py",
    "backend/models.py",
    "backend/schemas.py",
    "backend/database.py",
    "frontend/src/App.jsx",
    "frontend/src/api.js",
    "frontend/src/index.css",
]


def read_codebase():
    parts = []
    for path in CODEBASE_FILES:
        if os.path.exists(path):
            content = open(path).read()
            parts.append(f"=== {path} ===\n{content}")
    return "\n\n".join(parts)


def ask_agent(codebase: str) -> str:
    client = Groq(api_key=GROQ_API_KEY)

    prompt = f"""You are an expert software engineer working on a Notes app.
The app has a React frontend, FastAPI backend, and MySQL database.

## User Story (GitHub Issue #{ISSUE_NUMBER})
Title: {ISSUE_TITLE}

{ISSUE_BODY}

## Current Codebase
{codebase}

## Your Task
Implement the user story by modifying the codebase files above.

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{{
  "summary": "one sentence describing what you did",
  "files": [
    {{
      "path": "backend/main.py",
      "content": "... full file content ..."
    }}
  ]
}}

Only include files that you actually changed. Write complete file contents, not diffs.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=8096,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def apply_changes(files: list[dict]):
    for f in files:
        path = f["path"]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            fh.write(f["content"])
        print(f"  wrote {path}")


def create_pr(branch: str, summary: str):
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(REPO_NAME)
    default_branch = repo.default_branch

    subprocess.run(["git", "config", "user.email", "agent@notes-app.com"], check=True)
    subprocess.run(["git", "config", "user.name", "Notes Agent"], check=True)
    subprocess.run(["git", "checkout", "-b", branch], check=True)
    subprocess.run(["git", "add", "."], check=True)
    subprocess.run(["git", "commit", "-m", f"feat: {ISSUE_TITLE} (closes #{ISSUE_NUMBER})"], check=True)
    subprocess.run(["git", "push", "origin", branch], check=True)

    pr = repo.create_pull(
        title=f"[Agent] {ISSUE_TITLE}",
        body=f"Closes #{ISSUE_NUMBER}\n\n## What changed\n{summary}\n\n---\n_Implemented automatically by the agent._",
        head=branch,
        base=default_branch,
    )
    print(f"PR created: {pr.html_url}")
    return pr.html_url


def comment_on_issue(text: str):
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(REPO_NAME)
    issue = repo.get_issue(ISSUE_NUMBER)
    issue.create_comment(text)


if __name__ == "__main__":
    import json
    import re

    print("Reading codebase...")
    codebase = read_codebase()

    print("Asking agent to implement the user story...")
    raw = ask_agent(codebase)

    # strip markdown code fences if the model wrapped the JSON
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw.strip())

    result = json.loads(raw)
    summary = result["summary"]
    files = result["files"]

    print(f"Agent summary: {summary}")
    print(f"Files to change: {[f['path'] for f in files]}")

    apply_changes(files)

    branch = f"agent/issue-{ISSUE_NUMBER}"
    pr_url = create_pr(branch, summary)

    comment_on_issue(f"✅ Done! PR opened: {pr_url}\n\n**Summary:** {summary}")
    print("Done.")
