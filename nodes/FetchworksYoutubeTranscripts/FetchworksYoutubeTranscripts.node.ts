import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

const ACTOR = 'fetchworks~youtube-transcript-scraper';
const BASE_URL = 'https://api.apify.com';
/** Jobs expected to yield fewer videos than this run on the synchronous endpoint. */
const SYNC_LIMIT = 60;
const DATASET_PAGE_SIZE = 1000;
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 30 * 60 * 1000;

export class FetchworksYoutubeTranscripts implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YouTube Transcripts (Fetchworks)',
		name: 'fetchworksYoutubeTranscripts',
		icon: { light: 'file:fetchworks.svg', dark: 'file:fetchworks.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Get YouTube transcripts (segments, text, SRT, VTT) from videos, channels, playlists, and search via the Fetchworks YouTube Transcript Scraper on Apify',
		defaults: {
			name: 'YouTube Transcripts (Fetchworks)',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'fetchworksApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Transcript(s)',
						value: 'getTranscripts',
						action: 'Get transcripts for one or more videos',
						description: 'Transcripts for one or more video URLs or IDs',
					},
					{
						name: 'Get Channel Transcripts',
						value: 'channel',
						action: 'Get transcripts for a channel',
						description: "Transcripts for a channel's uploads, newest first",
					},
					{
						name: 'Get Playlist Transcripts',
						value: 'playlist',
						action: 'Get transcripts for a playlist',
						description: 'Transcripts for every video in a playlist',
					},
					{
						name: 'Search',
						value: 'search',
						action: 'Get transcripts for search results',
						description: 'Transcripts for the top results of a YouTube search',
					},
				],
				default: 'getTranscripts',
			},
			{
				displayName: 'Video URLs or IDs',
				name: 'videoUrls',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
				description:
					'One or more YouTube video URLs (watch, youtu.be, Shorts, embed, live) or bare 11-character video IDs, separated by commas or newlines',
				displayOptions: {
					show: {
						operation: ['getTranscripts'],
					},
				},
			},
			{
				displayName: 'Channel URL or @Handle',
				name: 'channelUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: '@3blue1brown',
				description:
					'Channel URL (youtube.com/@handle, /channel/UC…, /c/…, /user/…) or a bare @handle',
				displayOptions: {
					show: {
						operation: ['channel'],
					},
				},
			},
			{
				displayName: 'Max Videos',
				name: 'maxVideosPerChannel',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 100,
				description: 'Upper bound on videos taken from the channel, newest first',
				displayOptions: {
					show: {
						operation: ['channel'],
					},
				},
			},
			{
				displayName: 'Playlist URL or ID',
				name: 'playlistUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://www.youtube.com/playlist?list=PL…',
				description: 'Playlist URL or a bare playlist ID (PL…, UU…)',
				displayOptions: {
					show: {
						operation: ['playlist'],
					},
				},
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'neural networks explained',
				description: 'YouTube search query; top video results are transcribed',
				displayOptions: {
					show: {
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxSearchResults',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Upper bound on videos taken from the search results',
				displayOptions: {
					show: {
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Include Chapters',
						name: 'includeChapters',
						type: 'boolean',
						default: false,
						description: 'Whether to include video chapters (one extra request per video)',
					},
					{
						displayName: 'Include Video Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: true,
						description:
							'Whether to include title, channel, duration, views, publish date, and more. Comes free with extraction.',
					},
					{
						displayName: 'Languages',
						name: 'languages',
						type: 'string',
						default: 'en',
						description:
							'Comma-separated language priority list (ISO codes, e.g. "en,de"). The first available caption track wins.',
					},
					{
						displayName: 'Output Formats',
						name: 'outputFormats',
						type: 'multiOptions',
						options: [
							{ name: 'Plain Text', value: 'text' },
							{ name: 'SRT Subtitles', value: 'srt' },
							{ name: 'Timestamped Segments', value: 'segments' },
							{ name: 'WebVTT Subtitles', value: 'vtt' },
						],
						default: ['segments', 'text'],
						description: 'Transcript representations to include on each item',
					},
					{
						displayName: 'Prefer Auto-Generated Captions',
						name: 'preferAutoGenerated',
						type: 'boolean',
						default: false,
						description:
							'Whether to prefer auto-generated (ASR) tracks when a manual caption track also exists',
					},
					{
						displayName: 'Translate To',
						name: 'translateTo',
						type: 'string',
						default: '',
						description:
							'Target language code (e.g. "es") for YouTube caption auto-translation. Best-effort; failures come back as translation_unavailable and are not billed.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const { input, expectedVideos } = buildActorInput(this, i);
				const transcripts = await runActor(this, input, expectedVideos);
				for (const transcript of transcripts) {
					returnData.push({
						json: transcript,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : String(error) },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

function buildActorInput(
	context: IExecuteFunctions,
	itemIndex: number,
): { input: IDataObject; expectedVideos: number } {
	const operation = context.getNodeParameter('operation', itemIndex) as string;
	const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;

	const input: IDataObject = {};
	if (typeof options.languages === 'string' && options.languages.trim() !== '') {
		input.languages = splitList(options.languages);
	}
	if (options.preferAutoGenerated === true) input.preferAutoGenerated = true;
	if (typeof options.translateTo === 'string' && options.translateTo.trim() !== '') {
		input.translateTo = options.translateTo.trim();
	}
	if (Array.isArray(options.outputFormats) && options.outputFormats.length > 0) {
		input.outputFormats = options.outputFormats;
	}
	if (options.includeMetadata === false) input.includeMetadata = false;
	if (options.includeChapters === true) input.includeChapters = true;

	if (operation === 'getTranscripts') {
		const videoUrls = splitList(context.getNodeParameter('videoUrls', itemIndex) as string);
		if (videoUrls.length === 0) {
			throw new NodeOperationError(context.getNode(), 'At least one video URL or ID is required', {
				itemIndex,
			});
		}
		input.videoUrls = videoUrls;
		return { input, expectedVideos: videoUrls.length };
	}

	if (operation === 'channel') {
		input.channelUrls = [context.getNodeParameter('channelUrl', itemIndex) as string];
		const maxVideos = context.getNodeParameter('maxVideosPerChannel', itemIndex) as number;
		input.maxVideosPerChannel = maxVideos;
		return { input, expectedVideos: maxVideos };
	}

	if (operation === 'playlist') {
		input.playlistUrls = [context.getNodeParameter('playlistUrl', itemIndex) as string];
		return { input, expectedVideos: Number.POSITIVE_INFINITY };
	}

	// search
	input.searchQueries = [context.getNodeParameter('query', itemIndex) as string];
	const maxResults = context.getNodeParameter('maxSearchResults', itemIndex) as number;
	input.maxSearchResults = maxResults;
	return { input, expectedVideos: maxResults };
}

function splitList(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

async function apiRequest(
	context: IExecuteFunctions,
	options: IHttpRequestOptions,
): Promise<IDataObject | IDataObject[]> {
	return (await context.helpers.httpRequestWithAuthentication.call(context, 'fetchworksApi', {
		baseURL: BASE_URL,
		json: true,
		...options,
	})) as IDataObject | IDataObject[];
}

async function runActor(
	context: IExecuteFunctions,
	input: IDataObject,
	expectedVideos: number,
): Promise<IDataObject[]> {
	if (expectedVideos < SYNC_LIMIT) {
		return (await apiRequest(context, {
			method: 'POST',
			url: `/v2/acts/${ACTOR}/run-sync-get-dataset-items`,
			qs: { clean: true },
			body: input,
		})) as IDataObject[];
	}

	const started = (await apiRequest(context, {
		method: 'POST',
		url: `/v2/acts/${ACTOR}/runs`,
		body: input,
	})) as { data: { id: string; defaultDatasetId: string } };

	const run = await waitForRun(context, started.data.id);
	if (run.status !== 'SUCCEEDED') {
		throw new NodeApiError(
			context.getNode(),
			{ runId: run.id, status: run.status },
			{ message: `Actor run ${run.id} finished with status ${run.status}` },
		);
	}
	return collectDataset(context, run.defaultDatasetId);
}

interface RunRecord extends IDataObject {
	id: string;
	status: string;
	defaultDatasetId: string;
}

async function waitForRun(context: IExecuteFunctions, runId: string): Promise<RunRecord> {
	const deadline = Date.now() + MAX_WAIT_MS;
	for (;;) {
		const res = (await apiRequest(context, {
			method: 'GET',
			url: `/v2/actor-runs/${runId}`,
		})) as { data: RunRecord };
		const { status } = res.data;
		if (status !== 'READY' && status !== 'RUNNING') return res.data;
		if (Date.now() >= deadline) {
			throw new NodeApiError(
				context.getNode(),
				{ runId, status },
				{ message: `Timed out waiting for actor run ${runId} (still ${status})` },
			);
		}
		await sleep(POLL_INTERVAL_MS);
	}
}

async function collectDataset(
	context: IExecuteFunctions,
	datasetId: string,
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	for (let offset = 0; ; offset += DATASET_PAGE_SIZE) {
		const page = (await apiRequest(context, {
			method: 'GET',
			url: `/v2/datasets/${datasetId}/items`,
			qs: { clean: true, format: 'json', offset, limit: DATASET_PAGE_SIZE },
		})) as IDataObject[];
		items.push(...page);
		if (page.length < DATASET_PAGE_SIZE) return items;
	}
}
