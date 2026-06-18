<script lang="ts">
	import LineMdLoadingTwotoneLoop from '~icons/line-md/loading-twotone-loop';

	const { text }: { text: string } = $props();
</script>

<div class="bg-amber-50 border border-gray-300 shadow-sm flex flex-col gap-4 justify-center items-center flex-3">
	<p class="text-xl">{text}</p>
	<LineMdLoadingTwotoneLoop class="size-12"/>
</div>