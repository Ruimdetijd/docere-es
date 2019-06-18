import puppeteer from 'puppeteer'
import express from 'express'

declare function extractFacsimiles(doc: XMLDocument): ExtractedFacsimile[]
declare function extractMetadata(doc: XMLDocument): ExtractedMetadata
declare function extractTextData(doc: XMLDocument, config: DocereConfig): ExtractedTextData
declare function prepareDocument(doc: XMLDocument, config: DocereConfig, id?: string): XMLDocument

async function extractData(docereConfigData: DocereConfigData, files: string[]) {
	const browser = await puppeteer.launch({
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
		]
	})

	const page = await browser.newPage()
	page.on('console', (msg: any) => {
		msg = msg.text()
		console.log('From page: ', msg)
	})
	await page.goto('http://localhost:3333')

	await page.addScriptTag({ path: `./build/puppenv.utils.js` })
	await page.addScriptTag({ content: docereConfigData.prepareDocument.toString() })
	await page.addScriptTag({ content: docereConfigData.extractFacsimiles.toString() })
	await page.addScriptTag({ content: docereConfigData.extractMetadata.toString() })
	await page.addScriptTag({ content: docereConfigData.extractTextData.toString() })

	const output = await page.evaluate(
		async function evaluateFunc(docereConfig: DocereConfig, fileNames: string[]): Promise<IndexData[]> {
			const data: IndexData[] = []

			for (const fileName of fileNames) {
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

				data.push({
					id: fileName.slice(-4) === '.xml' ? fileName.slice(0, -4) : fileName,
					text: doc.documentElement.textContent,
					facsimiles,
					...metadata,
					...textData
				})

				console.log(`Prepared and extracted data from: "${fileName}"`)
			}

			return data
		},
		docereConfigData.config as any,
		files
	)

	browser.close()

	return output
}

export default async function main(
	docereConfigData: DocereConfigData,
	files: string[]
): Promise<IndexData[]> {
	const app = express()
	app.disable('x-powered-by')
	app.use(express.static(`node_modules/docere-config/projects`))
	app.get('/', (_req, res) => res.send(`<html><head></head><body><canvas></canvas></body></html>`))
	const server = app.listen(3333)

	let output

	try {
		output = await extractData(docereConfigData, files) 
	} catch (err) {
		console.log("ANOTHER ERRR", err)	
	}

	server.close()

	return output
}
