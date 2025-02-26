import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, Menu, TFile, WorkspaceLeaf, setIcon, FileView } from 'obsidian';

interface CopyOutlineSettings {
	useHashMarks: boolean;
}

const DEFAULT_SETTINGS: CopyOutlineSettings = {
	useHashMarks: false
}

export default class CopyOutlinePlugin extends Plugin {
	settings: CopyOutlineSettings;

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const outlineLeaves = this.app.workspace.getLeavesOfType('outline');

				for (const leaf of outlineLeaves) {
					if (leaf.view.containerEl.querySelector('.copy-outline-button')) {
						continue;
					}

					this.addCopyButton(leaf);
					this.addContextMenu(leaf);
				}
			})
		);

		this.addSettingTab(new SettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private addCopyButton(leaf: WorkspaceLeaf) {
		const navButtonsContainer = leaf.view.containerEl.querySelector('.nav-buttons-container');
		if (!navButtonsContainer) return;

		const button = navButtonsContainer.createEl('button', {
			cls: ['clickable-icon', 'copy-outline-button'],
			attr: { 'aria-label': 'Copy outline' }
		});

		setIcon(button, 'copy');

		button.addEventListener('click', async () => {
			const file = (leaf.view as FileView).file;
			if (!file) {
				new Notice('No file is associated with this outline');
				return;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.headings) {
				new Notice('No headings found in the current file');
				return;
			}

			const outline = cache.headings
				.map(heading => this.formatHeading(heading))
				.join('\n');

			await navigator.clipboard.writeText(outline);
			new Notice(`Copied ${cache.headings.length} headings to clipboard`);
		});
	}

	private addContextMenu(leaf: WorkspaceLeaf) {
		this.registerDomEvent(leaf.view.containerEl, 'contextmenu', (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			const outlineItem = target.closest('.tree-item');
			if (!outlineItem) return;

			const headingEl = outlineItem.querySelector('.tree-item-inner');
			if (!headingEl) return;

			const headingTitle = headingEl.textContent;
			const file = (leaf.view as FileView).file;
			if (!file) return;

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.headings) return;

			const headingIndex = cache.headings.findIndex(h => h.heading === headingTitle);
			if (headingIndex === -1) return;

			event.preventDefault();
			event.stopPropagation();

			const menu = new Menu();
			menu.addItem(item => 
				item
					.setTitle('Copy section outline')
					.setIcon('copy')
					.onClick(() => {
						const sectionOutline = this.getSectionOutline(cache.headings ?? [], headingIndex);
						const headingCount = this.countHeadingsInSection(cache.headings ?? [], headingIndex);
						navigator.clipboard.writeText(sectionOutline);
						new Notice(`Copied ${headingCount} headings to clipboard`);
					})
			);

			menu.showAtMouseEvent(event);
		});
	}

	private formatHeading(heading: { level: number; heading: string }): string {
		if (this.settings.useHashMarks) {
			return `${'#'.repeat(heading.level)} ${heading.heading}`;
		}
		return `${'\t'.repeat(heading.level - 1)}- ${heading.heading}`;
	}

	private getSectionOutline(headings: any[], startIndex: number): string {
		const startLevel = headings[startIndex].level;
		const section = [this.formatHeading(headings[startIndex])];

		for (let i = startIndex + 1; i < headings.length; i++) {
			const heading = headings[i];
			if (heading.level <= startLevel) break;
			section.push(this.formatHeading(heading));
		}

		return section.join('\n');
	}

	private countHeadingsInSection(headings: any[], startIndex: number): number {
		const startLevel = headings[startIndex].level;
		let count = 1; // Count the starting heading

		for (let i = startIndex + 1; i < headings.length; i++) {
			if (headings[i].level <= startLevel) break;
			count++;
		}

		return count;
	}
}

class SettingTab extends PluginSettingTab {
	plugin: CopyOutlinePlugin;

	constructor(app: App, plugin: CopyOutlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Use hashmarks')
			.setDesc('Use "#" instead of indentation for heading levels')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useHashMarks)
				.onChange(async (value) => {
					this.plugin.settings.useHashMarks = value;
					await this.plugin.saveSettings();
				}));
	}
}
