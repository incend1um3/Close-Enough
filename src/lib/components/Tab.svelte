<script lang="ts">
	import { page } from "$app/state";

	type Tab = {
		href: string,
		title: string,
		subtitle?: string,
	};

	let { 
		tabs = [], 
	}: {
		tabs: Tab[],
	} = $props();
</script>

<div>
	<div role="tablist" class="flex gap-[5%] items-stretch w-full border-b-2 border-gray-200 mb-8">
		{#each tabs as tab (tab.href)}
			<a 
				href={tab.href}
				role="tab"
				aria-selected={page.url.pathname.includes(tab.href)}
				class={"flex flex-col pb-2 cursor-pointer justify-center items-center translate-y-0.5" + (page.url.pathname.includes(tab.href) ? " border-b-3 border-amber-500" : "")}
			>
				{#if tab.subtitle}
					<p class="text-lg sm:text-xl font-semibold">{tab.title}</p>
					<p class="-translate-y-1 opacity-50 hidden sm:block">{tab.subtitle}</p>
				{:else}
					{tab.title}
				{/if}
			</a>
		{/each}
	</div>
</div>