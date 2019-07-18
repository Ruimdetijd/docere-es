import * as fs from 'fs'
import * as path from 'path'
import Puppenv from './puppenv'
import './puppenv.utils'
require = require('esm')(module) 
const defaultDocereConfigData = require('docere-config').default

function logError(msg: string) {
	console.log("\x1b[31m", msg, "\x1b[0m")
}

import indexDocument, { createIndex, deleteIndex } from './index-document'

async function main() {
	const projectSlug = process.argv[2]
	if (projectSlug == null) return logError('No project ID!')

	const configPath = path.resolve(`node_modules/docere-config/projects/${projectSlug}/index.js`)
	if (!fs.existsSync(configPath)) {
		return logError(`No config file for project: ${projectSlug}`)
	}
	const dcdImport: { default: DocereConfigData } = await import(configPath)
	const docereConfigData: DocereConfigData = {
		...defaultDocereConfigData,
		...dcdImport.default,
		config: {...defaultDocereConfigData.config, ...dcdImport.default.config }
	}

	const files = fs.readdirSync(`node_modules/docere-config/projects/${projectSlug}/xml`)
	if (!files.length) {
		return logError(`No files found for project: ${projectSlug}`)
	}

	const puppenv = new Puppenv(docereConfigData)
	await puppenv.start()
	const indexData = await puppenv.parseFile(files[0])
	const metadataKeys = new Set(Object.keys(indexData))

	await deleteIndex(projectSlug)
	await createIndex(projectSlug, indexData, docereConfigData.config)

	for (const file of files.slice(1)) {
		const indexData = await puppenv.parseFile(file)
		await indexDocument(projectSlug, indexData)
		console.log(`Indexed document "${indexData.id}" of "${projectSlug}"`)
	}

	await puppenv.close()

	// Of all the found metadata and text data remove the already configured keys. 
	// docereConfigData.config.metadata.forEach(md => metadataKeys.delete(md.id))
	// docereConfigData.config.textdata.forEach(td => metadataKeys.delete(td.id))
	// Remove the keys specifically added for the index
	metadataKeys.delete('id')
	metadataKeys.delete('facsimiles')
	metadataKeys.delete('text')
	if (metadataKeys.size) console.warn(`Unconfigured metadata:`, ...metadataKeys)
}

main()
