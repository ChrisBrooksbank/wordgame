import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				forge: {
					amber: '#f59e0b',
					orange: '#f97316',
					red: '#ef4444',
					'amber-light': '#fde68a',
					'orange-light': '#fed7aa',
					'red-dark': '#b91c1c',
					ember: '#7c2d12'
				}
			},
			backgroundImage: {
				'forge-gradient': 'linear-gradient(135deg, #f59e0b, #f97316, #ef4444)'
			}
		}
	},
	plugins: []
} satisfies Config;
