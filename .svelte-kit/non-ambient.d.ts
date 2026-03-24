
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/architect" | "/cascade" | "/daily" | "/memory" | "/rush";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/architect": Record<string, never>;
			"/cascade": Record<string, never>;
			"/daily": Record<string, never>;
			"/memory": Record<string, never>;
			"/rush": Record<string, never>
		};
		Pathname(): "/" | "/architect" | "/cascade" | "/daily" | "/memory" | "/rush";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.png" | "/favicon.svg" | "/icons/icon.svg" | "/manifest.webmanifest" | string & {};
	}
}