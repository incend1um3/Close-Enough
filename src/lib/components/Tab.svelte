<script lang="ts">
	import type { Snippet } from "svelte";

	type Tab = {
		id: string,
		title: string,
		subtitle?: string,
		content: Snippet,
	};

	let { 
		tabs = [], 
		active = $bindable(tabs[0]?.id)
	}: {
		tabs: Tab[],
		active?: string
	} = $props();
	
	let activeTab = $derived(tabs.find(t => t.id === active))
</script>

<div>
	<div role="tablist" class="flex gap-[5%] items-stretch w-full border-b-2 border-gray-200 mb-8">
		{#each tabs as tab (tab.id)}
			<button 
				role="tab"
				aria-selected={tab.id === activeTab?.id}
				class={"flex flex-col pb-2 cursor-pointer justify-center items-center translate-y-0.5" + (tab.id === activeTab?.id ? " border-b-3 border-amber-500" : "")}
				onclick={() => active = tab.id}
			>
				{#if tab.subtitle}
					<p class="text-lg sm:text-xl font-semibold">{tab.title}</p>
					<p class="-translate-y-1 opacity-50 hidden sm:block">{tab.subtitle}</p>
				{:else}
					{tab.title}
				{/if}
			</button>
		{/each}
	</div>

	
	{#if activeTab}
		<div role="tabpanel">
			{@render activeTab.content()}
		</div>
	{/if}
</div>