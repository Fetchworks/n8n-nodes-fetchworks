# Workflow templates

Two ready-to-import n8n workflows using the YouTube Transcripts (Fetchworks) node. In n8n: Workflows → Import from File, then set the credentials marked `REPLACE_WITH_...`.

## summarize-youtube-video-with-ai.json

Manual trigger → set a video URL → fetch the transcript (plain text) → summarize it with an OpenAI model. Swap the last node for any LLM node you prefer; the transcript is on `{{ $json.text }}` and the video title on `{{ $json.metadata.title }}`.

## channel-uploads-to-notion.json

Polls a channel's public RSS feed (`https://www.youtube.com/feeds/videos.xml?channel_id=...`) every hour, fetches a transcript for each new upload, and saves title + transcript to a Notion database. Find the channel ID on the channel's About page or in the page source (`"channelId"`).

Both workflows need a Fetchworks API credential — your Apify token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations). Pricing: $2 per 1,000 transcripts, only delivered transcripts billed ([actor page](https://apify.com/fetchworks/youtube-transcript-scraper)).
