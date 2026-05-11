import type { Icon } from "astro-icon/components";

export type Project = {
	slug: string;
	name: string;
	category: string;
	status: string;
	role: string;
	description: string;
	tags: string[];
	link: string;
	icon: Parameters<typeof Icon>[0]["name"];
	image: string;
};

export const projects: Project[] = [
	{
		slug: "fuwari-personal-os",
		name: "Fuwari Personal OS",
		category: "Site",
		status: "ACTIVE BUILD",
		role: "Design / Frontend / Content System",
		description: "把个人博客改造成二次元审美驱动的技术档案站：主页、文章、动画记录、项目展示都围绕同一套个人世界观重组。",
		tags: ["Astro", "TypeScript", "Personal OS", "视觉重构中"],
		link: "/",
		icon: "material-symbols:article-outline",
		image: "/cover.png",
	},
];
