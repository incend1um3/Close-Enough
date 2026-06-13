<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Plain-text tooltip content (ignored if `children` is provided) */
		text?: string;
		/** Accessible label for the icon button */
		label?: string;
		/** Icon diameter in px */
		size?: number;
		/** Max tooltip width in px */
		maxWidth?: number;
		/** Rich content for the tooltip, overrides `text` */
		children?: Snippet;
	}

	let {
		text = '',
		label = 'More information',
		size = 18,
		maxWidth = 280,
		children
	}: Props = $props();

	const tooltipId = `info-tooltip-${crypto.randomUUID()}`;

	let visible = $state(false);
	let position = $state<'top' | 'bottom'>('top');
	let offset = $state(0);
	let arrowLeft = $state(0);

	let triggerEl: HTMLButtonElement | undefined;
	let tooltipEl: HTMLDivElement | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	const margin = 8;
	const gap = 10;

	async function updatePosition() {
		// Wait for the tooltip to render before measuring it.
		await tick();
		if (!triggerEl || !tooltipEl) return;

		const trigger = triggerEl.getBoundingClientRect();
		const tooltip = tooltipEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// Flip above/below depending on available space
		const spaceAbove = trigger.top;
		const spaceBelow = vh - trigger.bottom;
		position =
			spaceAbove >= tooltip.height + gap || spaceAbove > spaceBelow ? 'top' : 'bottom';

		// Shift left/right so the tooltip never overflows the viewport
		const center = trigger.left + trigger.width / 2;
		const half = tooltip.width / 2;

		if (center - half < margin) {
			offset = margin - (center - half);
		} else if (center + half > vw - margin) {
			offset = vw - margin - (center + half);
		} else {
			offset = 0;
		}

		// Arrow points back at the icon's center, clamped to the tooltip body
		const ideal = tooltip.width / 2 - offset - 4; // 4 = half the 8px arrow
		arrowLeft = Math.max(margin, Math.min(ideal, tooltip.width - margin - 8));
	}

	function show() {
		clearTimeout(hideTimer);
		visible = true;
		updatePosition();
	}

	function hide() {
		visible = false;
	}

	function scheduleHide() {
		clearTimeout(hideTimer);
		// Small grace period so the cursor can travel onto the tooltip body
		hideTimer = setTimeout(hide, 120);
	}

	function toggle() {
		visible ? hide() : show();
	}

	function handlePointerEnter(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		show();
	}

	function handlePointerLeave(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		scheduleHide();
	}

	function handleWindowClick(event: MouseEvent) {
		if (visible && triggerEl && !triggerEl.contains(event.target as Node)) {
			hide();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') hide();
	}

	function handleReposition() {
		if (visible) updatePosition();
	}
</script>

<svelte:window
	onclick={handleWindowClick}
	onkeydown={handleKeydown}
	onresize={handleReposition}
	onscroll={handleReposition}
/>

<span class="relative inline-flex items-center align-middle leading-0">
	<button
		bind:this={triggerEl}
		type="button"
		class="inline-flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
		style:width="{size}px"
		style:height="{size}px"
		aria-label={label}
		aria-describedby={visible ? tooltipId : undefined}
		onpointerenter={handlePointerEnter}
		onpointerleave={handlePointerLeave}
		onclick={toggle}
		onfocus={show}
		onblur={hide}
	>
		<svg viewBox="0 0 24 24" width="100%" height="100%" class="block" aria-hidden="true">
			<circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
			<circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" stroke-width="1.5" />
			<circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
			<rect x="10.85" y="10.5" width="2.3" height="6.5" rx="1.15" fill="currentColor" />
		</svg>
	</button>

	{#if visible}
		<div
			bind:this={tooltipEl}
			transition:fade={{ duration: 120 }}
			id={tooltipId}
			role="tooltip"
			class="absolute left-1/2 z-50 w-max rounded-md bg-zinc-800 px-3 py-2 text-left text-[13px] leading-snug text-zinc-50 shadow-lg {position ===
			'top'
				? 'bottom-[calc(100%+10px)]'
				: 'top-[calc(100%+10px)]'}"
			style:max-width="min({maxWidth}px, calc(100vw - 16px))"
			style:transform="translateX(calc(-50% + {offset}px))"
			onpointerenter={show}
			onpointerleave={scheduleHide}
		>
			{#if children}
				{@render children()}
			{:else}
				{text}
			{/if}

			<!-- arrow, always pointing back at the icon's center -->
			<div
				class="absolute h-2 w-2 rotate-45 bg-zinc-800 {position === 'top'
					? '-bottom-1'
					: '-top-1'}"
				style:left="{arrowLeft}px"
			></div>
		</div>
	{/if}
</span>