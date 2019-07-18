import puppeteer from 'puppeteer'
import express from 'express'
import { Server } from 'http';

declare function extractFacsimiles(doc: XMLDocument): ExtractedFacsimile[]
declare function extractMetadata(doc: XMLDocument): ExtractedMetadata
declare function extractTextData(doc: XMLDocument, config: DocereConfig): ExtractedTextData
declare function prepareDocument(doc: XMLDocument, config: DocereConfig, id?: string): XMLDocument

async function evaluateFunc(docereConfig: DocereConfig, fileName: string): Promise<IndexData> {
	const xmlRoot = await fetchXml(`./${docereConfig.slug}/xml/${fileName}`)

	// TODO use ID for when splitting is needed
	// Prepare document
	const doc = await prepareDocument(xmlRoot, docereConfig)

	// Facsimiles
	const facsimiles = extractFacsimiles(doc)

	// Text data
	let textData = {} as any
	const textdataTmp = extractTextData(doc, docereConfig)
	Object.keys(textdataTmp).forEach(key => {
		const data = textdataTmp[key]
		textData[key] = data.map(d => d.value)
	})

	// Metadata
	const metadata = extractMetadata(doc)

	// console.log(`Prepared and extracted data from: "${fileName}"`)

	return {
		id: fileName.slice(-4) === '.xml' ? fileName.slice(0, -4) : fileName,
		text: doc.documentElement.textContent,
		facsimiles,
		...metadata,
		...textData
	}
}

export default class Puppenv {
	private browser: puppeteer.Browser
	private server: Server
	private page: puppeteer.Page

	constructor(private docereConfigData: DocereConfigData) {
		const app = express()
		app.disable('x-powered-by')
		app.use(express.static(`node_modules/docere-config/projects`))
		app.get('/', (_req, res) => res.send(`<html><head></head><body><canvas></canvas></body></html>`))
		this.server = app.listen(3333)
	}

	async start() {
		this.browser = await puppeteer.launch({
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
			]
		})

		this.page = await this.browser.newPage()
		this.page.on('console', (msg: any) => {
			msg = msg.text()
			console.log('From page: ', msg)
		})
		await this.page.goto('http://localhost:3333')

		await this.page.addScriptTag({ path: `./build/puppenv.utils.js` })
		await this.page.addScriptTag({ content: this.docereConfigData.prepareDocument.toString() })
		await this.page.addScriptTag({ content: this.docereConfigData.extractFacsimiles.toString() })
		await this.page.addScriptTag({ content: this.docereConfigData.extractMetadata.toString() })
		await this.page.addScriptTag({ content: this.docereConfigData.extractTextData.toString() })
	}

	async parseFile(fileName: string) {
		return await this.page.evaluate(
			evaluateFunc,
			this.docereConfigData.config as any,
			fileName
		)
	}

	close() {
		this.browser.close()
		this.server.close()
	}
}

// export default async function main(
// 	docereConfigData: DocereConfigData,
// 	files: string[]
// ): Promise<IndexData[]> {
// 	const app = express()
// 	app.disable('x-powered-by')
// 	app.use(express.static(`node_modules/docere-config/projects`))
// 	app.get('/', (_req, res) => res.send(`<html><head></head><body><canvas></canvas></body></html>`))
// 	const server = app.listen(3333)

// 	let output

// 	try {
// 		output = await extractData(docereConfigData, files) 
// 	} catch (err) {
// 		console.log("ANOTHER ERRR", err)	
// 	}

// 	server.close()

// 	return output
// }
