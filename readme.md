# Github issue to pulses

 - convert github issues to dapulse entries


# Usage
Clone repo

Install dependencies
`npm install`

Create a config.json file using this template at repo root

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