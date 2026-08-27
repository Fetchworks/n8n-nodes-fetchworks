# n8n-nodes-fetchworks

An n8n community node for YouTube transcripts — timestamped segments, plain text, SRT, and VTT from videos, Shorts, channels, playlists, and search results.

The node is a thin client for the [Fetchworks YouTube Transcript Scraper](https://apify.com/fetchworks/youtube-transcript-scraper) on Apify. The extraction runs on Apify's infrastructure; you bring your own Apify token. Pricing is $2 per 1,000 transcripts — only delivered transcripts are billed. Failed videos (no captions, blocked, unavailable) cost nothing.

## Installation

In n8n: Settings → Community Nodes → Install → `n8n-nodes-fetchworks`.

Self-hosted via npm:

```bash
npm install n8n-nodes-fetchworks
```

See the [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

## Credentials

Create a "Fetchworks API" credential with your Apify API token. Sign up free at [apify.com](https://console.apify.com/sign-up), then copy the token from [Settings → API & Integrations](https://console.apify.com/settings/integrations).

## Operations

One node — **YouTube Transcripts (Fetchworks)** — with four operations:

| Operation | Input | Notes |
| --- | --- | --- |
| Get Transcript(s) | One or more video URLs or 11-char IDs (comma/newline separated) | watch, youtu.be, Shorts, embed, and live URLs all work |
| Get Channel Transcripts | Channel URL or @handle | Newest first, bounded by Max Videos (default 100) |
| Get Playlist Transcripts | Playlist URL or ID | Whole playlist |
| Search | A YouTube search query | Top results, bounded by Max Results (default 50) |

Options on every operation: Languages (priority list), Prefer Auto-Generated Captions, Translate To, Output Formats (segments / text / SRT / VTT), Include Video Metadata, Include Chapters.

Each video becomes one output item with an honest `status` field (`ok`, `no_captions`, `blocked`, `live_stream`, `age_restricted`, `unavailable`, `translation_unavailable`, `po_token_required`, `error`) — a video without captions is an explicit `no_captions` item, never a silently empty transcript. Small jobs run on Apify's synchronous endpoint and return in seconds; large jobs (whole channels, playlists) start an actor run and the node polls until it finishes.

## Templates

Two importable workflows in [`templates/`](./templates):

- **Summarize a YouTube video with AI** — transcript → LLM summary.
- **New channel uploads → transcript → Notion** — RSS-triggered channel watch, transcripts saved to a Notion database.

## Links

- Actor page and pricing: https://apify.com/fetchworks/youtube-transcript-scraper
- Apify API tokens: https://console.apify.com/settings/integrations

## License

MIT
