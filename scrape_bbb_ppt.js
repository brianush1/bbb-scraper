const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const blobStream = require("blob-stream");

window.scrapey = function() {
	let base = document.querySelector("image").getAttribute("xlink:href");
	base = base.substring(0, base.lastIndexOf("/") + 1);
	const cache = new Map;
	async function download(slide) {
		if (cache.has(slide)) {
			return cache.get(slide);
		}
		const x = await fetch(base + slide);
		if (x.status === 200) {
			cache.set(slide, await x.text());
		}
		else {
			cache.set(slide, undefined);
		}
		return cache.get(slide);
	}
	async function exists(slide) {
		return await download(slide) !== undefined;
	}
	async function isLast(slide) {
		return await exists(slide) && !await exists(slide + 1);
	}
	async function findLastSlide() {
		let low = 1;
		let high = 512;
		while (low <= high) {
			let mid = (low + high) / 2 | 0;
			if (await isLast(mid))
				return mid;
			if (await exists(mid))
				low = mid + 1;
			else
				high = mid - 1;
		}
		return 512;
	}
	function parseSize(size) {
		const stuff = Number(size.substring(0, size.length - 2));
		if (size.endsWith("in")) {
			return stuff * 72;
		}
		else {
			return stuff;
		}
	}
	(async () => {
		const lastSlide = await findLastSlide();

		const parser = new DOMParser();
		const svg1 = parser.parseFromString(await download(1), "image/svg+xml").querySelector("svg");
		const width = parseSize(svg1.getAttribute("width"));
		const height = parseSize(svg1.getAttribute("height"));
		const doc = new PDFDocument({
			size: [width, height],
			margins: {
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
			},
		});
		const stream = doc.pipe(blobStream());
		for (let slide = 1; slide <= lastSlide; ++slide) {
			if (slide > 1) {
				doc.addPage();
			}
			const data = await download(slide);
			SVGtoPDF(doc, data, 0, 0);
		}
		doc.end();
		stream.on("finish", () => {
			const a = document.createElement("a");
			a.style.display = "none";
			a.href = stream.toBlobURL("application/pdf");
			let title = document.title;
			if (title.startsWith("BigBlueButton -")) {
				title = title.substring("BigBlueButton -".length);
			}
			if (title.endsWith("Conference")) {
				title = title.substring(0, title.length - "Conference".length);
			}
			title = title.trim();
			if (title === "") {
				title = "presentation";
			}
			a.download = `${title}.pdf`;
			a.click();
			URL.revokeObjectURL(a.href);
			a.remove();
		});
	})();
};