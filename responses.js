// collection of company-specific response formats

const grokRes = {
	id: '456b5c1c-13bc-9dca-9dd4-d1960a5e5272',
	object: 'chat.completion',
	created: 1776308670,
	model: 'grok-4-1-fast-non-reasoning',
	choices: [ { index: 0, message: [Object], finish_reason: 'length' } ],
	usage: {
		prompt_tokens: 205,
		completion_tokens: 3,
		total_tokens: 208,
		prompt_tokens_details: {
		text_tokens: 205,
		audio_tokens: 0,
		image_tokens: 0,
		cached_tokens: 204
		},
		completion_tokens_details: {
		reasoning_tokens: 0,
		audio_tokens: 0,
		accepted_prediction_tokens: 0,
		rejected_prediction_tokens: 0
		},
		num_sources_used: 0,
		cost_in_usd_ticks: 119000
	},
	system_fingerprint: 'fp_cae30ef979'
}
grokRes.usage.prompt_tokens
const anthropicRes = {
	model: 'claude-haiku-4-5-20251001',
	id: 'msg_01FtXyrY7j6RkD3bsB6WVaRS',
	type: 'message',
	role: 'assistant',
	content: [ { type: 'text', text: '```\nls -' } ],
	stop_reason: 'max_tokens',
	stop_sequence: null,
	stop_details: null,
	usage: {
		input_tokens: 45,
		cache_creation_input_tokens: 0,
		cache_read_input_tokens: 0,
		cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
		output_tokens: 4,
		service_tier: 'standard',
		inference_geo: 'not_available'
	}
}