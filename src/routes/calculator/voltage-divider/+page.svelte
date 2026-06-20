<script lang="ts">
	import { page } from "$app/state";
	import { getCalculatorContext } from "$lib/calculator/context";
	import BestMatch from "$lib/components/BestMatch.svelte";
	import ErrorWidget from "$lib/components/ErrorWidget.svelte";
	import LoadingWidget from "$lib/components/LoadingWidget.svelte";
	import Match from "$lib/components/Match.svelte";
	import VoltageDividerInput from "$lib/components/VoltageDividerInput.svelte";
	import { BASE_URL, SITE_NAME } from "$lib/constants";
	import type { WithContext, WebApplication } from "schema-dts";
	import LogoWithBG from "$lib/assets/logo.png";

	const context = getCalculatorContext();

	const pageTitle = "Voltage Divider Solver - " + SITE_NAME;
	const pageDescription = "Calculate the resistor pair that produces your target output voltage, with current and impedance constraints, from E-Series values.";
	const canonicalURL = `${BASE_URL}${page.url.pathname}`;
	
	const structuredData: WithContext<WebApplication> = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: "Voltage Divider Solver",
		description: pageDescription,
		applicationCategory: "Utility",
		operatingSystem: "Any",
		url: canonicalURL,
	}

	$effect(() => {
		localStorage.setItem("voltage-divider-solver-values", JSON.stringify(context.voltageDivider.computeReq));
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta 
		name="description"
		content={pageDescription}
	/>
	<link rel="canonical" href={canonicalURL} />
	
	{@html `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`}

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonicalURL} />
	<meta property="og:image" content={LogoWithBG} />
 
	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={LogoWithBG} />
</svelte:head>

<div class="flex gap-12 flex-wrap">
	<VoltageDividerInput
		bind:computeReq={context.voltageDivider.computeReq}
		bind:error={context.voltageDivider.inputError}
		class="flex-2"
	/>
	{#if !context.voltageDivider.inputError}
		{#await context.voltageDivider.resultsPromise}
			<LoadingWidget text="Solving..."/>
		{:then results}
			{#if results && results.length > 0}
				<div class="flex flex-col gap-3 flex-3">
					<BestMatch selectedCombination={results[0]} targetValue={context.voltageDivider.computeReq.vout} solveTime={context.voltageDivider.solveTime}/>
					<p class="opacity-70 mt-5 tracking-wider">ALTERNATIVES</p>
					<div class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
						{#each results.slice(1) as c}
							<Match selectedCombination={c} targetValue={context.voltageDivider.computeReq.vout}/>
						{/each}
					</div>
				</div>
			{:else if results?.length === 0}
				<ErrorWidget />
			{:else}
				<LoadingWidget text="Waiting for cache to load..." />
			{/if}		
		{/await}
	{:else}
		<ErrorWidget />
	{/if}
</div>

