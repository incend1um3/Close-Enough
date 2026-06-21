import { BASE_URL } from "$lib/constants";

export const prerender = true;

const routes = [
	'/calculator/resistance',
	'/calculator/voltage-divider'
];

export async function GET() {
	const body = sitemap(routes);
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml'
		}
	});
}

function sitemap(routes: string[]) {
	return `<?xml version="1.0" encoding="UTF-8" ?>
			<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
				${routes
					.map(
						(route) => `<url>
    						<loc>${BASE_URL}${route}</loc>
 						</url>`
					)
				.join('\n')}
			</urlset>`;
}