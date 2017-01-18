# Github copy issue from github to pulses in dapulse

 - Fetch issues from a selected github repo
 - Fetch pulse from selected dapulse board
 - Create new issues as new pulses
 - update existing issues


# Usage
Clone repo

Install dependencies
`npm install` at project root

Create a `config.json` file using this template at repo root

```
{
  "github": {
    "token": "<github-generated-token>",
    "repo": "<github-repo-slug>",
    "owner": "<github-owner-slug>"
  },
  "dapulse": {
    "token": "<dapulse-api-key>",
    "board": <dapulse-board-id>,
    "userId": <dapulse-user-id>
  }
}
```

Run the script
`npm start`