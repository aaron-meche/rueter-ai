// collection of company-specific response formats

const grokResponse = {
	id: '48dac11e-8092-97e7-856d-9deec92c6ad4',
	object: 'chat.completion',
	created: 1776297032,
	model: 'grok-4-1-fast-non-reasoning',
	choices: [{ index: 0, message: [Object], finish_reason: 'stop' }],
	usage: {
		prompt_tokens: 169,
		completion_tokens: 9,
		total_tokens: 178,
		prompt_tokens_details: {
			text_tokens: 169,
			audio_tokens: 0,
			image_tokens: 0,
			cached_tokens: 168
		},
		completion_tokens_details: {
			reasoning_tokens: 0,
			audio_tokens: 0,
			accepted_prediction_tokens: 0,
			rejected_prediction_tokens: 0
		},
		num_sources_used: 0,
		cost_in_usd_ticks: 131000
	},
	system_fingerprint: 'fp_cae30ef979'
}