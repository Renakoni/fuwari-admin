import { defineCollection, z } from "astro:content";
import type { CollectionConfig } from "astro/content/config";

const postsSchema: any = z.object({
	title: z.string(),
	published: z.date(),
	updated: z.date().optional(),
	draft: z.boolean().optional().default(false),
	description: z.string().optional().default(""),
	image: z.string().optional().default(""),
	tags: z.array(z.string()).optional().default([]),
	category: z.string().optional().nullable().default(""),
	notebook: z.string().optional().default("Misc"),
	lang: z.string().optional().default(""),

	/* For internal use */
	prevTitle: z.string().default(""),
	prevSlug: z.string().default(""),
	nextTitle: z.string().default(""),
	nextSlug: z.string().default(""),
});

const postsCollection: CollectionConfig<typeof postsSchema> = defineCollection({
	schema: postsSchema,
});
export const collections: Record<"posts", CollectionConfig<typeof postsSchema>> = {
	posts: postsCollection,
};
