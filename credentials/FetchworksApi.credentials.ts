import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FetchworksApi implements ICredentialType {
	name = 'fetchworksApi';

	displayName = 'Fetchworks API';

	documentationUrl = 'https://apify.com/fetchworks/youtube-transcript-scraper';

	properties: INodeProperties[] = [
		{
			displayName: 'Apify API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Apify API token. Sign up free at apify.com, then copy the token from Settings > API & Integrations.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				token: '={{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.apify.com',
			url: '/v2/users/me',
		},
	};
}
