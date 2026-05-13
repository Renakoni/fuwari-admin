import { h } from "hastscript";

function textFromNode(node) {
	if (!node) return "";
	if (node.type === "text") return node.value || "";
	if (Array.isArray(node.children)) return node.children.map(textFromNode).join("");
	return "";
}

function splitInlineTabs(value) {
	return value.split("\n").flatMap((line) => {
		const match = line.match(/^([^=\n]+?)\s*=\s*(.+)$/);
		return match ? [{ label: match[1].trim(), children: [h("pre", [h("code", match[2].trim())])] }] : [];
	});
}

function splitTabs(children) {
	const code = children?.[0]?.tagName === "pre" ? textFromNode(children[0]) : "";
	if (code) return splitInlineTabs(code);
	const tabs = [];
	let current = null;
	for (const child of children || []) {
		const text = textFromNode(child).trim();
		const inlineTabs = splitInlineTabs(text);
		if (inlineTabs.length > 0 && !current) {
			tabs.push(...inlineTabs);
			continue;
		}
		const match = text.match(/^==\s+(.+)$/);
		if (match) {
			if (current) tabs.push(current);
			current = { label: match[1].trim(), children: [] };
			continue;
		}
		if (current) current.children.push(child);
	}
	if (current) tabs.push(current);
	return tabs.filter((tab) => tab.label);
}

export function TabsComponent(_properties, children) {
	const tabs = splitTabs(children);
	if (tabs.length === 0) {
		return h("div", { class: "hidden" }, 'Invalid tabs directive. Use ":::tabs" with "== Tab" sections.');
	}

	return h("div", { class: "fuwari-tabs" }, [
		h("div", { class: "fuwari-tabs-rail" }, tabs.map((tab, index) => h("span", { class: index === 0 ? "active" : "" }, tab.label))),
		...tabs.map((tab, index) => h("section", { class: `fuwari-tab-panel${index === 0 ? " active" : ""}` }, [h("div", { class: "fuwari-tab-label" }, tab.label), ...tab.children])),
	]);
}
