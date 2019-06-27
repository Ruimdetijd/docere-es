import * as fs from 'fs'
import * as path from 'path'
import puppenv from './puppenv'
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
	const data = await puppenv(docereConfigData, files)

	// Update the index
	await deleteIndex(projectSlug)
	await createIndex(projectSlug, docereConfigData.config)

	// Create a Set of metadata and textdata keys to enable a check 
	// which meta/text data is not configured
	const metadataKeys = new Set()

	// Loop through every document in order to index them
	for (const d of data) {
		// Add the metadata and textdata keys to the Set
		Object.keys(d).forEach(key => metadataKeys.add(key))

		await indexDocument(projectSlug, d)
		console.log(`Indexed document "${d.id}" of "${projectSlug}"`)
	}


	// Of all the found metadata and text data remove the already configured keys. 
	docereConfigData.config.metadata.forEach(md => metadataKeys.delete(md.id))
	docereConfigData.config.textdata.forEach(td => metadataKeys.delete(td.id))
	// Remove the keys specifically added for the index
	metadataKeys.delete('id')
	metadataKeys.delete('facsimiles')
	metadataKeys.delete('text')
	if (metadataKeys.size) console.warn(`Unconfigured metadata:`, ...metadataKeys)
}

main()
